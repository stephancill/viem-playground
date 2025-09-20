import Dexie from "dexie";

export interface StoredABI {
  id?: number;
  name: string; // e.g., "CoinbaseSmartWalletABI"
  abi: any[]; // Raw ABI JSON array
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

export interface StoredScript {
  id?: number;
  name: string;
  content: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ScriptDatabase extends Dexie {
  scripts!: Dexie.Table<StoredScript, number>;

  constructor() {
    super("ScriptDatabase");
    this.version(1).stores({
      scripts: "++id, name, createdAt, updatedAt",
    });
  }
}

export const abiDb = new ABIDatabase();
export const scriptDb = new ScriptDatabase();
