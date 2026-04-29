import { collection, doc, setDoc, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { db as firestore, auth } from '../lib/firebase.ts';
import { db as local } from '../db.ts';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class CloudSyncService {
  private static liveUnsubscribers: (() => void)[] = [];

  static startLiveSync() {
    this.stopLiveSync();

    console.log('Starting Live Sync capabilities...');
    
    // Listen to Suppliers
    const unsubSuppliers = onSnapshot(collection(firestore, 'suppliers'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const d = change.doc;
        const data = d.data();
        
        if (change.type === 'added' || change.type === 'modified') {
           const existing = await local.suppliers.get(d.id);
           const remoteUpdatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now());

           if (!existing || remoteUpdatedAt > existing.updatedAt || existing.synced) {
             await local.suppliers.put({
                id: d.id,
                name: data.name || 'Unknown',
                phone: data.phone || '',
                location: data.location || '',
                joinDate: data.joinDate || Date.now(),
                bankName: data.bankName || '',
                accountNumber: data.accountNumber || '',
                walletBalance: data.walletBalance || 0,
                synced: true,
                updatedAt: remoteUpdatedAt
             });
           }
        } else if (change.type === 'removed') {
           await local.suppliers.delete(d.id);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'suppliers');
    });

    // Listen to Milk Records
    const unsubMilk = onSnapshot(collection(firestore, 'milkRecords'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const d = change.doc;
        const data = d.data();
        if (change.type === 'added' || change.type === 'modified') {
           await local.milkRecords.put({
             id: d.id,
             supplierId: data.supplierId,
             liters: data.liters,
             supplierName: data.supplierName,
             timestamp: data.timestamp || Date.now(),
             pricePerLiter: data.pricePerLiter || 0,
             totalAmount: data.totalAmount || data.amount || 0,
             status: data.status,
             amountPaid: data.amountPaid || 0,
             paymentDueDate: data.paymentDueDate || 0,
             updatedAt: data.updatedAt || Date.now(),
             synced: true
           });
        } else if (change.type === 'removed') {
           await local.milkRecords.delete(d.id);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'milkRecords');
    });

    // Listen to Transactions
    const unsubTx = onSnapshot(collection(firestore, 'transactions'), async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const d = change.doc;
        const data = d.data();
        if (change.type === 'added' || change.type === 'modified') {
           await local.transactions.put({
             id: d.id,
             type: data.type,
             supplierId: data.supplierId,
             supplierName: data.supplierName,
             amount: data.amount,
             timestamp: data.timestamp || Date.now(),
             description: data.description || '',
             status: data.status || 'SUCCESS',
             synced: true
           });
        } else if (change.type === 'removed') {
           await local.transactions.delete(d.id);
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    this.liveUnsubscribers.push(unsubSuppliers, unsubMilk, unsubTx);
  }

  static stopLiveSync() {
     this.liveUnsubscribers.forEach(unsub => unsub());
     this.liveUnsubscribers = [];
  }

  static async syncAll() {
    console.log('Starting Cloud Sync (Push)...');
    await this.syncSuppliers();
    await this.syncMilkRecords();
    console.log('Starting Cloud Sync (Pull)...');
    // Using live sync should handle pull dynamically, but we keep this just in case
    await this.pullServerData();
    console.log('Sync Complete.');
  }

  private static async pullServerData() {
    try {
      const snap = await getDocs(collection(firestore, 'suppliers'));
      for (const d of snap.docs) {
        const data = d.data();
        const existing = await local.suppliers.get(d.id);
        if (existing) {
           await local.suppliers.update(d.id, {
             walletBalance: data.walletBalance ?? existing.walletBalance,
             // only update balance on pull to avoid local draft overwrites
           });
        } else {
           await local.suppliers.add({
             id: d.id,
             name: data.name || 'Unknown',
             phone: data.phone || '',
             location: data.location || '',
             joinDate: data.joinDate || Date.now(),
             bankName: data.bankName || '',
             accountNumber: data.accountNumber || '',
             walletBalance: data.walletBalance || 0,
             synced: true,
             updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now())
           });
        }
      }
    } catch (e) {
      console.error('Failed to pull server data:', e);
      handleFirestoreError(e, OperationType.GET, 'suppliers');
    }
  }

  private static async syncSuppliers() {
    const unsynced = await local.suppliers.filter(s => !s.synced).toArray();
    for (const supplier of unsynced) {
      try {
        const { synced, walletBalance, ...data } = supplier;
        // Include synced so schema passes. For walletBalance, we conditionally add it if it's new.
        // Actually, to make it work seamlessly with the Firestore merge and schema:
        await setDoc(doc(firestore, 'suppliers', supplier.id), {
          ...data,
          joinDate: supplier.joinDate || supplier.updatedAt || Date.now(),
          walletBalance: supplier.walletBalance || 0,
          synced: true,
          updatedAt: supplier.updatedAt || Date.now()
        }, { merge: true });
        await local.suppliers.update(supplier.id, { synced: true });
      } catch (e) {
        console.error('Failed to sync supplier:', supplier.id, e);
      }
    }
  }

  private static async syncMilkRecords() {
    const unsynced = await local.milkRecords.filter(r => !r.synced).toArray();
    for (const record of unsynced) {
      try {
        const { synced, liters, supplierId, ...data } = record;
        
        // Use our custom backend to handle financial atomicity
        const { default: api } = await import('../lib/api.ts');
        await api.post('/api/wallet/credit', {
          supplierId,
          amount: data.totalAmount || (liters * (data.pricePerLiter || 500)), 
          description: `Milk collection: ${liters} liters`,
          liters,
          pricePerLiter: data.pricePerLiter,
          milkRecordId: record.id
        });

        await local.milkRecords.update(record.id, { synced: true });
      } catch (e) {
        if (e && typeof e === 'object' && 'response' in e && (e as any).response?.data?.error === 'Supplier not found') {
          console.error('Skipping invalid milk record (supplier missing):', record.id);
          await local.milkRecords.update(record.id, { synced: true });
        } else {
          console.error('Failed to sync milk record:', record.id, e);
        }
      }
    }
  }
}
