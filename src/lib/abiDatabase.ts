import Dexie from "dexie";

export interface StoredABI {
  id?: number;
  name: string; // e.g., "CoinbaseSmartWalletABI"
  abi: any[]; // Raw ABI JSON array
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredScript {
  id?: number;
  name: string;
  code: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ABIDatabase extends Dexie {
  abis!: Dexie.Table<StoredABI, number>;

  constructor() {
    super("ABIDatabase");
    this.version(1).stores({
      abis: "++id, name, createdAt, updatedAt",
    });
  }
}

export const abiDb = new ABIDatabase();
