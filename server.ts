import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Application error with an HTTP status code for client-safe errors
class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Global Error Handler utility setup
const logError = (err: any, req: Request) => {
  // In production, this should stream to Sentry/Google Cloud Logging
  const errorLog = {
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    user: (req as any).user?.id || 'unauthenticated',
    message: err.message,
    stack: err.stack,
  };
  console.error(JSON.stringify(errorLog));
};

// --- INITIALIZE FIREBASE ADMIN ---
if (!admin.apps.length) {
  let credential = admin.credential.applicationDefault();
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = admin.credential.cert(serviceAccountJson);
      console.log('Using FIREBASE_SERVICE_ACCOUNT from environment variables.');
    } catch (err) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT env var: ${(err as Error).message}`);
    }
  }
  admin.initializeApp({
    credential,
    projectId: firebaseConfig.projectId,
  });
}

import { getFirestore } from 'firebase-admin/firestore';
const db = getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId);
import crypto from 'crypto';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabling CSP for Vite HMR and dynamic preview compatibility
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

app.use(express.json());
app.use(cookieParser());

const allowedOrigins: string[] = [];
if (process.env.VITE_APP_URL) allowedOrigins.push(process.env.VITE_APP_URL);
if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate Limiter
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

// --- AUTH MIDDLEWARE ---
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Look up latest user document to verify active state
    const userDocRef = await db.collection('users').doc(decoded.id).get();
    if (userDocRef.exists) {
       const data = userDocRef.data();
       if (data?.status === 'INACTIVE') {
          return res.status(403).json({ error: 'Account deactivated. Contact Support.' });
       }
       if (data?.status === 'PENDING') {
          return res.status(403).json({ error: 'Account pending approval. Please contact administrator.' });
       }
       req.user = { ...decoded, ...data }; // attach latest db data
    } else {
       req.user = decoded;
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Token' });
  }
};

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  name: string;
  status?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// --- FINANCIAL ENGINE ---

// Get Company Balance
app.get('/api/company/balance', authenticate, async (req, res) => {
  try {
    const companyRef = db.collection('system').doc('companyBalance');
    const doc = await companyRef.get();
    res.json({ balance: doc.data()?.balance || 0 });
  } catch (e) {
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message });
  }
});

// Credit Wallet (Milk added)
app.post('/api/wallet/credit', authenticate, async (req, res) => {
  try {
    const { supplierId, amount, description, liters, milkRecordId, pricePerLiter } = z.object({
      supplierId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid supplierId format'),
      amount: z.number().positive().max(100000000, 'Amount too large'),
      description: z.string().max(500, 'Description too long'),
      liters: z.number().positive().max(100000, 'Liters too large'),
      milkRecordId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid milkRecordId format'),
      pricePerLiter: z.number().positive().max(10000, 'Price too high').optional()
    }).parse(req.body);

    const supplierRef = db.collection('suppliers').doc(supplierId);
    const milkRecordRef = db.collection('milkRecords').doc(milkRecordId);
    
    await db.runTransaction(async (transaction) => {
      const supplierDoc = await transaction.get(supplierRef);
      if (!supplierDoc.exists) throw new AppError('Supplier not found', 404);

      const milkRecordDoc = await transaction.get(milkRecordRef);
      if (milkRecordDoc.exists) {
        // Idempotency: skip if already recorded
        return;
      }

      const supplierData = supplierDoc.data()!;
      const newWalletBalance = (supplierData.walletBalance || 0) + amount;

      const txRef = db.collection('transactions').doc();
      transaction.set(supplierRef, { walletBalance: newWalletBalance }, { merge: true });
      
      transaction.set(milkRecordRef, {
        id: milkRecordId,
        supplierId,
        agentId: req.user.id, // Audit trail
        supplierName: supplierData.name || 'Unknown',
        liters,
        pricePerLiter: pricePerLiter || (amount / liters),
        totalAmount: amount,
        amountPaid: 0,
        status: 'PAID',
        timestamp: Date.now(),
        updatedAt: Date.now()
      });

      transaction.set(txRef, {
        id: txRef.id,
        type: 'CREDIT',
        supplierId,
        agentId: req.user.id, // Audit trail
        amount,
        balanceBefore: supplierData.walletBalance || 0,
        balanceAfter: newWalletBalance,
        timestamp: Date.now(),
        reference: `CREDIT-${Date.now()}`,
        description,
        status: 'SUCCESS'
      });
    });

    res.json({ message: 'Wallet credited successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || 'Validation error' });
    if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message });
  }
});

// Withdraw Cash
app.post('/api/wallet/withdraw/cash', authenticate, async (req, res) => {
  try {
    const { supplierId, amount, transactionId } = z.object({
      supplierId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid supplierId format'),
      amount: z.number().positive().max(100000000, 'Amount too large'),
      transactionId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid transactionId format'),
    }).parse(req.body);

    const supplierRef = db.collection('suppliers').doc(supplierId);
    const companyRef = db.collection('system').doc('companyBalance');
    const txRef = db.collection('transactions').doc(transactionId);

    await db.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(txRef);
      if (txDoc.exists) return; // Idempotency check

      const supplierDoc = await transaction.get(supplierRef);
      const companyDoc = await transaction.get(companyRef);
      
      if (!supplierDoc.exists) throw new AppError('Supplier not found', 404);
      
      const supplierData = supplierDoc.data()!;
      const companyData = companyDoc.exists ? companyDoc.data()! : { balance: 0 };

      const supplierBalance = supplierData.walletBalance || 0;
      const companyBalance = companyData.balance || 0;

      if (supplierBalance < amount) {
        throw new AppError('Insufficient wallet balance', 422);
      }
      if (companyBalance < amount) {
        throw new AppError('Insufficient company funds to process payout', 422);
      }

      const newWalletBalance = supplierBalance - amount;
      const newCompanyBalance = companyBalance - amount;

      transaction.set(supplierRef, { walletBalance: newWalletBalance }, { merge: true });
      transaction.set(companyRef, { balance: newCompanyBalance }, { merge: true });
      
      transaction.set(txRef, {
        id: transactionId,
        type: 'WITHDRAWAL_CASH',
        supplierId,
        agentId: req.user.id, // Audit trail
        amount,
        balanceBefore: supplierBalance,
        balanceAfter: newWalletBalance,
        timestamp: Date.now(),
        reference: `CASH-${Date.now()}`,
        status: 'SUCCESS'
      });
    });

    res.json({ message: 'Cash withdrawn successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || 'Validation error' });
    if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message });
  }
});

// Withdraw to Bank
app.post('/api/wallet/withdraw/bank', authenticate, async (req, res) => {
  try {
    const { supplierId, amount, transactionId } = z.object({
      supplierId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid supplierId format'),
      amount: z.number().positive().max(100000000, 'Amount too large'),
      transactionId: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid transactionId format'),
    }).parse(req.body);

    const supplierRef = db.collection('suppliers').doc(supplierId);
    const companyRef = db.collection('system').doc('companyBalance');
    const txRef = db.collection('transactions').doc(transactionId);

    await db.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(txRef);
      if (txDoc.exists) return; // Idempotency check

      const supplierDoc = await transaction.get(supplierRef);
      const companyDoc = await transaction.get(companyRef);

      if (!supplierDoc.exists) throw new Error('Supplier not found');
      
      const supplierData = supplierDoc.data()!;
      const companyData = companyDoc.exists ? companyDoc.data()! : { balance: 0 };

      const supplierBalance = supplierData.walletBalance || 0;
      const companyBalance = companyData.balance || 0;

      if (supplierBalance < amount) {
        throw new AppError('Insufficient wallet balance', 422);
      }
      if (companyBalance < amount) {
         throw new AppError('Insufficient company funds to process transfer', 422);
      }

      const newWalletBalance = supplierBalance - amount;
      const newCompanyBalance = companyBalance - amount;

      transaction.set(supplierRef, { walletBalance: newWalletBalance }, { merge: true });
      transaction.set(companyRef, { balance: newCompanyBalance }, { merge: true });
      
      transaction.set(txRef, {
        id: transactionId,
        type: 'WITHDRAWAL_BANK',
        supplierId,
        agentId: req.user!.id, // Audit trail
        amount,
        balanceBefore: supplierBalance,
        balanceAfter: newWalletBalance,
        timestamp: Date.now(),
        reference: `BANK-${Date.now()}`,
        status: 'SUCCESS' // Or PENDING if hitting actual transfer API
      });
    });

    res.json({ message: 'Bank withdrawal processed successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || 'Validation error' });
    if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message });
  }
});

// Paystack live verify
app.post('/api/payments/verify-paystack', authenticate, async (req, res) => {
  try {
    const { reference } = z.object({ reference: z.string().regex(/^[a-zA-Z0-9_\-]+$/, 'Invalid reference format') }).parse(req.body);

    if (!PAYSTACK_SECRET) throw new AppError('Paystack not configured', 503);

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });
    
    let data;
    try {
      data = await response.json();
    } catch(e) {
      throw new Error('Paystack returned an invalid response.');
    }

    if (!response.ok || !data.status || data.data.status !== 'success') {
      console.error('Paystack verification failed:', data);
      throw new Error(`Paystack Error: ${data?.message || 'Payment verification failed'}`);
    }

    const amountKobo = data.data.amount; // Paystack returns in kobo
    const amount = amountKobo / 100;

    const companyRef = db.collection('system').doc('companyBalance');
    const txRef = db.collection('transactions').doc(reference);

    await db.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(txRef);
      if (txDoc.exists) {
        throw new AppError('Payment already verified', 409); // Idempotency
      }

      const companyDoc = await transaction.get(companyRef);
      const currentBalance = companyDoc.exists ? (companyDoc.data()?.balance || 0) : 0;
      const newCompanyBalance = currentBalance + amount;

      transaction.set(companyRef, { balance: newCompanyBalance }, { merge: true });
      transaction.set(txRef, {
        id: reference,
        type: 'DEPOSIT',
        amount,
        balanceBefore: currentBalance,
        balanceAfter: newCompanyBalance,
        timestamp: Date.now(),
        reference,
        status: 'SUCCESS'
      });
    });

    res.json({ message: 'Company account funded successfully' });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || 'Validation error' });
    if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message });
  }
});

// Paystack Webhook
app.post('/api/webhooks/paystack', async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      // Paystack amount is in kobo normally, but verify webhook data structure
      const amountKobo = data.amount; 
      const amount = amountKobo / 100;

      const companyRef = db.collection('system').doc('companyBalance');
      const txRef = db.collection('transactions').doc(reference);

      await db.runTransaction(async (transaction) => {
        const txDoc = await transaction.get(txRef);
        if (txDoc.exists) {
          return; // Idempotency - already processed by frontend verify or previous webhook event
        }

        const companyDoc = await transaction.get(companyRef);
        const currentBalance = companyDoc.exists ? (companyDoc.data()?.balance || 0) : 0;
        const newCompanyBalance = currentBalance + amount;

        transaction.set(companyRef, { balance: newCompanyBalance }, { merge: true });
        transaction.set(txRef, {
          id: reference,
          type: 'DEPOSIT',
          amount,
          balanceBefore: currentBalance,
          balanceAfter: newCompanyBalance,
          timestamp: Date.now(),
          reference,
          status: 'SUCCESS',
          source: 'WEBHOOK'
        });
      });
    }

    // Always return 200 OK to Paystack
    res.sendStatus(200);
  } catch (e) {
    logError(e, {} as Request);
    // Always return 200 to prevent Paystack from retrying the webhook
    res.sendStatus(200);
  }
});

// --- AUTH ENDPOINTS ---
app.post('/api/auth/google', async (req, res) => {
  try {
    const { firebaseIdToken } = req.body;
    if (!firebaseIdToken) throw new AppError('Missing firebaseIdToken', 400);

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    let user;
    
    let role = 'AGENT';
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
    
    if (email && adminEmails.includes(email.toLowerCase())) {
        role = 'ADMIN';
    }

    if (!userDoc.exists) {
      user = {
        id: uid,
        name: decodedToken.name || 'Google User',
        email: email,
        password: '', // No password for Google users
        role: role,
        status: role === 'ADMIN' ? 'ACTIVE' : 'PENDING',
        createdAt: Date.now()
      };
      await userRef.set(user);
    } else {
      user = userDoc.data();
      if (!user.status) {
         user.status = role === 'ADMIN' ? 'ACTIVE' : 'PENDING';
         await userRef.set({ status: user.status }, { merge: true });
      }
      // Auto-update to ADMIN if they became admin later
      if (user.role !== role && role === 'ADMIN') {
         await userRef.set({ role: 'ADMIN', status: 'ACTIVE' }, { merge: true });
         user.role = 'ADMIN';
         user.status = 'ACTIVE';
      }
    }

    if (user.status === 'PENDING') {
       throw new AppError('Account pending approval. Please contact administrator.', 403);
    }
    if (user.status === 'INACTIVE') {
       throw new AppError('Account deactivated. Contact Support.', 403);
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    // Google auth on frontend already has user session in firebase, but we provide our regular custom token just in case
    const customToken = await admin.auth().createCustomToken(user.id, { role: user.role });

    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 3600000 });
    res.json({ message: 'Google login successful', user: { id: user.id, email: user.email, role: user.role, name: user.name }, firebaseToken: customToken });
  } catch (e) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Authentication failed' : (e as Error).message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const u = req.user!;
  res.json({ user: { id: u.id, email: u.email, role: u.role, name: u.name } });
});

// --- ADMIN / AGENT MANAGEMENT ENDPOINTS ---

app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').limit(1000).get();
    const users = usersSnapshot.docs.map(doc => {
       const data = doc.data();
       return {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          status: data.status || 'ACTIVE',
          createdAt: data.createdAt
       };
    });
    res.json({ users });
  } catch (e) {
    logError(e, req);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message || 'Internal error' });
  }
});

app.put('/api/admin/users/:id/status', authenticate, requireAdmin, async (req, res) => {
   try {
     const { id } = z.object({ id: z.string().regex(/^[a-zA-Z0-9_\-]+$/) }).parse({ id: req.params.id });
     const { status, role } = z.object({
       status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
       role: z.enum(['AGENT', 'ADMIN']).optional()
     }).parse(req.body);
     
     const userRef = db.collection('users').doc(id);
     const doc = await userRef.get();
     if (!doc.exists) throw new AppError('User not found', 404);
     
     if (id === req.user?.id) {
       return res.status(400).json({ error: "Cannot modify own account." });
     }

     const updateData: any = {};
     if (status) updateData.status = status;
     if (role) updateData.role = role;

     await userRef.set(updateData, { merge: true });
     res.json({ message: 'User updated successfully' });
   } catch (e) {
     if (e instanceof z.ZodError) return res.status(400).json({ error: e.issues[0]?.message || 'Validation error' });
     if (e instanceof AppError) return res.status(e.statusCode).json({ error: e.message });
     logError(e, req);
     res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (e as Error).message || 'Update failed' });
   }
});

// Centralized error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logError(err, req);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred. Please try again later.' 
      : err.message || 'Internal Server Error'
  });
});

// START SERVER
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
