declare module "net-snmp" {
  export const Version1: number
  export const Version2c: number
  export const ObjectType: {
    OctetString: number
  }

  export function createSession(
    target: string,
    community: string,
    options: {
      version: number
      port: number
      timeout: number
      retries: number
    },
  ): {
    get(
      oids: string[],
      callback: (error: Error | null, varbinds: Array<{ oid: string; value: unknown }>) => void,
    ): void
    getBulk(
      oids: string[],
      nonRepeaters: number,
      maxRepetitions: number,
      callback: (error: Error | null, varbinds: Array<Array<{ oid: string; value: unknown }> | { oid: string; value: unknown }>) => void,
    ): void
    set(
      varbinds: Array<{ oid: string; type: number; value: unknown }>,
      callback: (error: Error | null, varbinds: Array<{ oid: string; value: unknown }>) => void,
    ): void
    close(): void
  }

  export function isVarbindError(varbind: { oid: string; value: unknown }): boolean
}
