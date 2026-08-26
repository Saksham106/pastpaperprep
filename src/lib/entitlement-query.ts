type QueryResult<Row> = {
  data: Row[] | null;
  error: unknown;
};

export function requireEntitlementRows<Row>({ data, error }: QueryResult<Row>): Row[] {
  if (error) throw new Error("Unable to verify current access", { cause: error });
  return data ?? [];
}