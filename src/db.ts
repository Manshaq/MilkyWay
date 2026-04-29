import Dexie, { type Table } from 'dexie';
import { Supplier, MilkRecord, Transaction, AppSettings } from './types.ts';

export class MilkyWayDB extends Dexie {
  suppliers!: Table<Supplier>;
  milkRecords!: Table<MilkRecord>;
  transactions!: Table<Transaction>;
  settings!: Table<AppSettings>;

  constructor() {
    super('MilkyWayDB');
    this.version(1).stores({
      suppliers: 'id, name, phone, location, synced',
      milkRecords: 'id, supplierId, timestamp, status, synced',
      transactions: 'id, type, supplierId, timestamp, synced',
      settings: 'key'
    });
  }
}

export const db = new MilkyWayDB();
