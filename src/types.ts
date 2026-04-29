/**
 * Core Data Models for MilkyWay System
 */

export type UserRole = 'ADMIN' | 'AGENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  location: string;
  joinDate: number;
  walletBalance: number;
  bankName: string;
  accountNumber: string;
  synced: boolean;
  updatedAt: number;
}

export interface MilkRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  timestamp: number;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  amountPaid: number;
  status: "PENDING" | "PARTIAL" | "PAID";
  paymentDueDate: number;
  synced: boolean;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  type: "WITHDRAWAL" | "WITHDRAWAL_CASH" | "WITHDRAWAL_BANK" | "PAYMENT" | "DEPOSIT" | "CREDIT";
  supplierId?: string;
  supplierName?: string;
  amount: number;
  timestamp: number;
  method?: string;
  description?: string;
  status: string;
  synced: boolean;
  updatedAt?: number;
}

export interface AppSettings {
  key: string;
  value: any;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface APIError {
  message: string;
  code?: string;
}
