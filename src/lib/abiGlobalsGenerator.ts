import { abiDb } from "./abiDatabase";

export interface ABIGlobalFiles {
  globalsDts: string;
  files: { path: string; content: string }[];
}

const toValidIdentifier = (name: string): string => {
  const cleaned = name.replace(/[^a-zA-Z0-9_$]/g, "_");
  const startsValid = /^[a-zA-Z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return startsValid;
};

export const generateABIGlobals = async (): Promise<ABIGlobalFiles> => {
  const abis = await abiDb.abis.toArray();

  const files: { path: string; content: string }[] = [];

  const globals: string[] = [];
  for (const abi of abis) {
    const id = toValidIdentifier(abi.name);
    const modulePath = `file:///types/abis/${id}.ts`;
    const content = `export const ${id} = ${JSON.stringify(
      abi.abi,
      null,
      2
    )} as const;`;
    files.push({ path: modulePath, content });
    globals.push(
      `declare global { const ${id}: typeof import('${modulePath}').${id}; }`
    );
  }

  const globalsDts = `// Global ABI constants with literal types\n${globals.join(
    "\n"
  )}\nexport {};`;

  return { globalsDts, files };
};
