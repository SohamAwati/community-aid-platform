import { LocalDatabaseEngine } from "./database";

type FilterOp = {
  column: string;
  op: "eq" | "neq" | "in" | "not_in" | "gte" | "lte" | "gt" | "lt" | "ilike" | "is" | "not_is";
  value: unknown;
};

export class LocalQueryBuilder<T = Record<string, unknown>> {
  private tableName: string;
  private engine: LocalDatabaseEngine;
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectColumns: string = "*";
  private selectOptions?: { count?: "exact"; head?: boolean };
  private filters: FilterOp[] = [];
  private orderColumn?: string;
  private orderAscending: boolean = true;
  private limitCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private payload?: Record<string, unknown> | Record<string, unknown>[];

  constructor(tableName: string) {
    this.tableName = tableName;
    this.engine = LocalDatabaseEngine.getInstance();
  }

  public select(columns: string = "*", options?: { count?: "exact"; head?: boolean }): this {
    this.action = "select";
    this.selectColumns = columns;
    this.selectOptions = options;
    return this;
  }

  public insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.action = "insert";
    this.payload = values;
    return this;
  }

  public update(values: Record<string, unknown>): this {
    this.action = "update";
    this.payload = values;
    return this;
  }

  public delete(): this {
    this.action = "delete";
    return this;
  }

  public upsert(values: Record<string, unknown> | Record<string, unknown>[], _options?: { onConflict?: string }): this {
    this.action = "upsert";
    this.payload = values;
    return this;
  }

  public eq(column: string, value: unknown): this {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  public neq(column: string, value: unknown): this {
    this.filters.push({ column, op: "neq", value });
    return this;
  }

  public in(column: string, values: unknown[]): this {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  public gte(column: string, value: unknown): this {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  public lte(column: string, value: unknown): this {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  public gt(column: string, value: unknown): this {
    this.filters.push({ column, op: "gt", value });
    return this;
  }

  public lt(column: string, value: unknown): this {
    this.filters.push({ column, op: "lt", value });
    return this;
  }

  public ilike(column: string, pattern: string): this {
    this.filters.push({ column, op: "ilike", value: pattern });
    return this;
  }

  public not(column: string, op: string, value: unknown): this {
    if (op === "is") {
      this.filters.push({ column, op: "not_is", value });
    } else if (op === "in") {
      let list: unknown[] = [];
      if (Array.isArray(value)) {
        list = value;
      } else if (typeof value === "string") {
        list = value
          .replace(/^[()]/, "")
          .replace(/[()]$/, "")
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""));
      }
      this.filters.push({ column, op: "not_in", value: list });
    } else if (op === "eq") {
      this.filters.push({ column, op: "neq", value });
    } else {
      this.filters.push({ column, op: "neq", value });
    }
    return this;
  }

  public is(column: string, value: unknown): this {
    this.filters.push({ column, op: "is", value });
    return this;
  }

  public order(column: string, options?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  public limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  public single(): this {
    this.isSingle = true;
    return this;
  }

  public maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  // Execute and return standard PostgrestResult promise
  public async then<TResult1 = { data: T | T[] | null; error: Error | null; count?: number | null }>(
    onfulfilled?: (value: { data: any; error: Error | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => any
  ): Promise<TResult1> {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : (result as unknown as TResult1);
    } catch (e) {
      if (onrejected) return onrejected(e);
      throw e;
    }
  }

  private async execute(): Promise<{ data: any; error: Error | null; count?: number | null }> {
    const tableData = this.engine.getTable(this.tableName);

    // 1. Handle INSERT
    if (this.action === "insert") {
      const rowsToInsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted: Record<string, unknown>[] = [];

      for (const row of rowsToInsert) {
        const newRow: Record<string, unknown> = {
          id: row.id || `${this.tableName.slice(0, 4)}-${Math.random().toString(36).substring(2, 9)}`,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...row,
        };
        tableData.push(newRow);
        inserted.push(newRow);

        // Triggers
        this.handleInsertTriggers(newRow);
      }

      this.engine.setTable(this.tableName, tableData);
      return {
        data: Array.isArray(this.payload) ? inserted : inserted[0] || null,
        error: null,
      };
    }

    // 2. Handle UPSERT
    if (this.action === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const saved: Record<string, unknown>[] = [];

      for (const row of rows) {
        let existingIndex = -1;
        if (row.id) {
          existingIndex = tableData.findIndex((r) => r.id === row.id);
        } else if (this.tableName === "reviews" && row.ngo_id && row.reviewer_id) {
          existingIndex = tableData.findIndex((r) => r.ngo_id === row.ngo_id && r.reviewer_id === row.reviewer_id);
        } else if (this.tableName === "saved_opportunities" && row.user_id && row.opportunity_id) {
          existingIndex = tableData.findIndex(
            (r) => r.user_id === row.user_id && r.opportunity_id === row.opportunity_id
          );
        }

        if (existingIndex >= 0) {
          const updated = {
            ...tableData[existingIndex],
            ...row,
            updated_at: new Date().toISOString(),
          };
          tableData[existingIndex] = updated;
          saved.push(updated);
        } else {
          const newRow = {
            id: row.id || `${this.tableName.slice(0, 4)}-${Math.random().toString(36).substring(2, 9)}`,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...row,
          };
          tableData.push(newRow);
          saved.push(newRow);
        }
      }

      this.engine.setTable(this.tableName, tableData);
      return {
        data: Array.isArray(this.payload) ? saved : saved[0] || null,
        error: null,
      };
    }

    // 3. Handle UPDATE
    if (this.action === "update") {
      const matchingIndices: number[] = [];
      tableData.forEach((row, idx) => {
        if (this.matchesFilters(row)) {
          matchingIndices.push(idx);
        }
      });

      const updatedRows: Record<string, unknown>[] = [];
      for (const idx of matchingIndices) {
        const oldRow = { ...tableData[idx] };
        const updated = {
          ...tableData[idx],
          ...this.payload,
          updated_at: new Date().toISOString(),
        };
        tableData[idx] = updated;
        updatedRows.push(updated);

        // Update triggers
        this.handleUpdateTriggers(oldRow, updated);
      }

      this.engine.setTable(this.tableName, tableData);
      return {
        data: this.isSingle || this.isMaybeSingle ? updatedRows[0] || null : updatedRows,
        error: null,
      };
    }

    // 4. Handle DELETE
    if (this.action === "delete") {
      const kept: Record<string, unknown>[] = [];
      const deleted: Record<string, unknown>[] = [];

      for (const row of tableData) {
        if (this.matchesFilters(row)) {
          deleted.push(row);
        } else {
          kept.push(row);
        }
      }

      this.engine.setTable(this.tableName, kept);
      return {
        data: this.isSingle || this.isMaybeSingle ? deleted[0] || null : deleted,
        error: null,
      };
    }

    // 5. Handle SELECT
    let filtered = tableData.filter((row) => this.matchesFilters(row));
    const totalCount = filtered.length;

    // Sorting
    if (this.orderColumn) {
      const col = this.orderColumn;
      const asc = this.orderAscending;
      filtered.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return asc ? 1 : -1;
        if (valB === undefined || valB === null) return asc ? -1 : 1;
        if (valA < valB) return asc ? -1 : 1;
        return asc ? 1 : -1;
      });
    }

    // Limit
    if (typeof this.limitCount === "number") {
      filtered = filtered.slice(0, this.limitCount);
    }

    // Head check (count only)
    if (this.selectOptions?.head) {
      return {
        data: null,
        error: null,
        count: totalCount,
      };
    }

    // Foreign-key expansion / column projections
    let projected = filtered.map((row) => this.expandRow(row, this.selectColumns));

    if (this.isSingle) {
      if (projected.length === 0) {
        return { data: null, error: new Error("Row not found"), count: totalCount };
      }
      return { data: projected[0], error: null, count: totalCount };
    }

    if (this.isMaybeSingle) {
      return { data: projected[0] || null, error: null, count: totalCount };
    }

    return {
      data: projected,
      error: null,
      count: this.selectOptions?.count ? totalCount : null,
    };
  }

  private matchesFilters(row: Record<string, unknown>): boolean {
    for (const f of this.filters) {
      let val = row[f.column];

      // Handle dotted column check if needed (e.g. "opportunities.ngo_id")
      if (f.column.includes(".")) {
        const [relTable, relCol] = f.column.split(".");
        if (relTable === "opportunities" && row.opportunity_id) {
          const opp = this.engine.getTable("opportunities").find((o) => o.id === row.opportunity_id);
          val = opp ? opp[relCol] : undefined;
        }
      }

      switch (f.op) {
        case "is":
          if (f.value === null) {
            if (val !== null && val !== undefined && val !== "") return false;
          } else {
            if (val !== f.value) return false;
          }
          break;
        case "not_is":
          if (f.value === null) {
            if (val === null || val === undefined || val === "") return false;
          } else {
            if (val === f.value) return false;
          }
          break;
        case "eq":
          if (f.value === null) {
            if (val !== null && val !== undefined && val !== "") return false;
          } else {
            if (String(val) !== String(f.value)) return false;
          }
          break;
        case "neq":
          if (f.value === null) {
            if (val === null || val === undefined || val === "") return false;
          } else {
            if (String(val) === String(f.value)) return false;
          }
          break;
        case "in": {
          const list = Array.isArray(f.value) ? f.value.map(String) : [];
          if (!list.includes(String(val))) return false;
          break;
        }
        case "not_in": {
          const list = Array.isArray(f.value) ? f.value.map(String) : [];
          if (list.includes(String(val))) return false;
          break;
        }
        case "gte":
          if (val === undefined || val === null || val < (f.value as any)) return false;
          break;
        case "lte":
          if (val === undefined || val === null || val > (f.value as any)) return false;
          break;
        case "gt":
          if (val === undefined || val === null || val <= (f.value as any)) return false;
          break;
        case "lt":
          if (val === undefined || val === null || val >= (f.value as any)) return false;
          break;
        case "ilike": {
          const pattern = String(f.value).replace(/%/g, ".*");
          const re = new RegExp(pattern, "i");
          if (!re.test(String(val || ""))) return false;
          break;
        }
      }
    }
    return true;
  }

  private expandRow(row: Record<string, unknown>, columns: string): Record<string, unknown> {
    const expanded = { ...row };

    // Check for nested relations requested in selectColumns
    // 1. ngos(...)
    if (columns.includes("ngos(") || columns.includes("ngos!inner(")) {
      const ngoId = (row.ngo_id as string) || (row.id as string);
      const ngo = this.engine.getTable("ngos").find((n) => n.id === ngoId);
      expanded.ngos = ngo || null;
    }

    // 2. opportunities(...)
    if (columns.includes("opportunities(") || columns.includes("opportunities!inner(")) {
      const oppId = (row.opportunity_id as string) || (row.id as string);
      const opp = this.engine.getTable("opportunities").find((o) => o.id === oppId);
      if (opp) {
        const oppCopy = { ...opp };
        // If nested ngos requested inside opportunities(...)
        if (columns.includes("ngos(name)") || columns.includes("ngos(")) {
          const ngo = this.engine.getTable("ngos").find((n) => n.id === opp.ngo_id);
          oppCopy.ngos = ngo ? { name: ngo.name, logo_url: ngo.logo_url } : null;
        }
        expanded.opportunities = oppCopy;
      } else {
        expanded.opportunities = null;
      }
    }

    // 3. badges(...)
    if (columns.includes("badges(")) {
      const badgeId = (row.badge_id as string) || (row.id as string);
      const badge = this.engine.getTable("badges").find((b) => b.id === badgeId);
      expanded.badges = badge || null;
    }

    // 4. profiles(...)
    if (columns.includes("profiles(")) {
      const profId = (row.user_id as string) || (row.volunteer_id as string) || (row.reviewer_id as string) || (row.id as string);
      const prof = this.engine.getTable("profiles").find((p) => p.id === profId);
      expanded.profiles = prof || null;
    }

    // 5. teams(...)
    if (columns.includes("teams(")) {
      const teamId = (row.team_id as string) || (row.id as string);
      const team = this.engine.getTable("teams").find((t) => t.id === teamId);
      expanded.teams = team || null;
    }

    return expanded;
  }

  private handleInsertTriggers(newRow: Record<string, unknown>) {
    // Notify channel on new notification
    if (this.tableName === "notifications") {
      this.engine.emitChange("notifications", "INSERT", newRow);
    }
  }

  private handleUpdateTriggers(oldRow: Record<string, unknown>, updatedRow: Record<string, unknown>) {
    // Application decision notification trigger
    if (
      this.tableName === "applications" &&
      oldRow.status !== updatedRow.status &&
      ["accepted", "rejected"].includes(String(updatedRow.status))
    ) {
      const opps = this.engine.getTable("opportunities");
      const opp = opps.find((o) => o.id === updatedRow.opportunity_id);
      const title = `Application ${updatedRow.status}`;
      const reason = updatedRow.rejection_reason ? `: ${updatedRow.rejection_reason}` : ": your application was accepted.";
      const body = `${opp?.title || "Volunteering Opportunity"}${reason}`;

      const notifs = this.engine.getTable("notifications");
      const newNotif = {
        id: "notif-" + Math.random().toString(36).substring(2, 9),
        user_id: updatedRow.volunteer_id,
        title,
        body,
        link: "/volunteer/applications",
        read: false,
        created_at: new Date().toISOString(),
      };
      notifs.unshift(newNotif);
      this.engine.setTable("notifications", notifs);
      this.engine.emitChange("notifications", "INSERT", newNotif);
    }
  }
}
