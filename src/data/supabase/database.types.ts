
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "accounts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"cut_off_day": number | null,"id": string,"institution": string | null,"kind": Database["public"]['Enums']["account_kind"],"name": string,"opening_balance_cents": number,"payment_due_offset_days": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"cut_off_day"?: number | null,"id"?: string,"institution"?: string | null,"kind": Database["public"]['Enums']["account_kind"],"name": string,"opening_balance_cents"?: number,"payment_due_offset_days"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"cut_off_day"?: number | null,"id"?: string,"institution"?: string | null,"kind"?: Database["public"]['Enums']["account_kind"],"name"?: string,"opening_balance_cents"?: number,"payment_due_offset_days"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"card_payments": {
                  Row: {
                    "amount_cents": number,"card_account_id": string,"created_at": string,"from_account_id": string | null,"id": string,"note": string | null,"paid_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"card_account_id": string,"created_at"?: string,"from_account_id"?: string | null,"id"?: string,"note"?: string | null,"paid_on": string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"card_account_id"?: string,"created_at"?: string,"from_account_id"?: string | null,"id"?: string,"note"?: string | null,"paid_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_payments_user_id_card_account_id_fkey"
      columns: ["user_id","card_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "card_payments_user_id_from_account_id_fkey"
      columns: ["user_id","from_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"card_statement_marks": {
                  Row: {
                    "card_account_id": string,"cut_off": string,"id": string,"marked_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_account_id": string,"cut_off": string,"id"?: string,"marked_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "card_account_id"?: string,"cut_off"?: string,"id"?: string,"marked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_statement_marks_user_id_card_account_id_fkey"
      columns: ["user_id","card_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"icon": string | null,"id": string,"macro": Database["public"]['Enums']["spend_bucket"],"name": string,"name_key": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"icon"?: string | null,"id"?: string,"macro": Database["public"]['Enums']["spend_bucket"],"name": string,"name_key"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"icon"?: string | null,"id"?: string,"macro"?: Database["public"]['Enums']["spend_bucket"],"name"?: string,"name_key"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"debtors": {
                  Row: {
                    "id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"user_id"?: string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"distribution_rules": {
                  Row: {
                    "created_at": string,"effective_from": string,"id": string,"investment_bps": number,"needs_bps": number,"user_id": string,"wants_bps": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_from": string,"id"?: string,"investment_bps": number,"needs_bps": number,"user_id"?: string,"wants_bps": number
                  }
                  Update: {
                    "created_at"?: string,"effective_from"?: string,"id"?: string,"investment_bps"?: number,"needs_bps"?: number,"user_id"?: string,"wants_bps"?: number
                  }
                  Relationships: [
                    
                  ]
                },"expense_templates": {
                  Row: {
                    "amount_cents": number,"archived": boolean,"created_at": string,"id": string,"name": string,"payment_account_id": string | null,"sort": number,"subcategory_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"archived"?: boolean,"created_at"?: string,"id"?: string,"name": string,"payment_account_id"?: string | null,"sort"?: number,"subcategory_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"archived"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"payment_account_id"?: string | null,"sort"?: number,"subcategory_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_templates_user_id_payment_account_id_fkey"
      columns: ["user_id","payment_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "expense_templates_user_id_subcategory_id_fkey"
      columns: ["user_id","subcategory_id"]
isOneToOne: false
      referencedRelation: "subcategories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_cents": number,"bucket": Database["public"]['Enums']["spend_bucket"],"created_at": string,"id": string,"note": string | null,"occurrence_date": string | null,"origin": Database["public"]['Enums']["expense_origin"],"payment_account_id": string | null,"recurring_expense_id": string | null,"spent_on": string,"subcategory_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"bucket": Database["public"]['Enums']["spend_bucket"],"created_at"?: string,"id"?: string,"note"?: string | null,"occurrence_date"?: string | null,"origin"?: Database["public"]['Enums']["expense_origin"],"payment_account_id"?: string | null,"recurring_expense_id"?: string | null,"spent_on": string,"subcategory_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"bucket"?: Database["public"]['Enums']["spend_bucket"],"created_at"?: string,"id"?: string,"note"?: string | null,"occurrence_date"?: string | null,"origin"?: Database["public"]['Enums']["expense_origin"],"payment_account_id"?: string | null,"recurring_expense_id"?: string | null,"spent_on"?: string,"subcategory_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_user_id_payment_account_id_fkey"
      columns: ["user_id","payment_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "expenses_user_id_recurring_expense_id_fkey"
      columns: ["user_id","recurring_expense_id"]
isOneToOne: false
      referencedRelation: "recurring_expenses"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "expenses_user_id_subcategory_id_fkey"
      columns: ["user_id","subcategory_id"]
isOneToOne: false
      referencedRelation: "subcategories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"goal_contributions": {
                  Row: {
                    "amount_cents": number,"goal_id": string,"id": string,"period_start": string,"source_bucket": Database["public"]['Enums']["bucket_kind"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"goal_id": string,"id"?: string,"period_start": string,"source_bucket": Database["public"]['Enums']["bucket_kind"],"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"goal_id"?: string,"id"?: string,"period_start"?: string,"source_bucket"?: Database["public"]['Enums']["bucket_kind"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_contributions_user_id_goal_id_fkey"
      columns: ["user_id","goal_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"goal_saved_moves": {
                  Row: {
                    "amount_cents": number,"created_at": string,"goal_id": string,"id": string,"moved_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"goal_id": string,"id"?: string,"moved_on": string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"goal_id"?: string,"id"?: string,"moved_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_saved_moves_user_id_goal_id_fkey"
      columns: ["user_id","goal_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "annual_cents": number | null,"archived_at": string | null,"completed_at": string | null,"created_at": string,"due_month": string | null,"id": string,"kind": Database["public"]['Enums']["goal_kind"],"monthly_cents": number | null,"name": string,"source_bucket": Database["public"]['Enums']["bucket_kind"],"target_cents": number | null,"target_months": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "annual_cents"?: number | null,"archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_month"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["goal_kind"],"monthly_cents"?: number | null,"name": string,"source_bucket": Database["public"]['Enums']["bucket_kind"],"target_cents"?: number | null,"target_months"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "annual_cents"?: number | null,"archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_month"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["goal_kind"],"monthly_cents"?: number | null,"name"?: string,"source_bucket"?: Database["public"]['Enums']["bucket_kind"],"target_cents"?: number | null,"target_months"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"income_allocations": {
                  Row: {
                    "account_id": string | null,"amount_cents": number,"bucket": Database["public"]['Enums']["bucket_kind"],"id": string,"income_id": string,"period_start": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount_cents": number,"bucket": Database["public"]['Enums']["bucket_kind"],"id"?: string,"income_id": string,"period_start": string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string | null,"amount_cents"?: number,"bucket"?: Database["public"]['Enums']["bucket_kind"],"id"?: string,"income_id"?: string,"period_start"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_allocations_user_id_account_id_fkey"
      columns: ["user_id","account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "income_allocations_user_id_income_id_fkey"
      columns: ["user_id","income_id"]
isOneToOne: false
      referencedRelation: "incomes"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"incomes": {
                  Row: {
                    "amount_cents": number,"created_at": string,"deposit_account_id": string | null,"distributed": boolean,"funded_period_start": string,"id": string,"income_type": Database["public"]['Enums']["income_type"],"is_recurring": boolean,"label": string,"received_on": string,"rule_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"deposit_account_id"?: string | null,"distributed"?: boolean,"funded_period_start": string,"id"?: string,"income_type"?: Database["public"]['Enums']["income_type"],"is_recurring"?: boolean,"label": string,"received_on": string,"rule_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"deposit_account_id"?: string | null,"distributed"?: boolean,"funded_period_start"?: string,"id"?: string,"income_type"?: Database["public"]['Enums']["income_type"],"is_recurring"?: boolean,"label"?: string,"received_on"?: string,"rule_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incomes_user_id_deposit_account_id_fkey"
      columns: ["user_id","deposit_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "incomes_user_id_rule_id_fkey"
      columns: ["user_id","rule_id"]
isOneToOne: false
      referencedRelation: "distribution_rules"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"installments": {
                  Row: {
                    "amount_cents": number,"card_due_on": string,"collected_cents": number,"collected_on": string | null,"due_on": string,"id": string,"receivable_id": string,"seq": number,"status": Database["public"]['Enums']["installment_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"card_due_on": string,"collected_cents"?: number,"collected_on"?: string | null,"due_on": string,"id"?: string,"receivable_id": string,"seq": number,"status"?: Database["public"]['Enums']["installment_status"],"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"card_due_on"?: string,"collected_cents"?: number,"collected_on"?: string | null,"due_on"?: string,"id"?: string,"receivable_id"?: string,"seq"?: number,"status"?: Database["public"]['Enums']["installment_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_user_id_receivable_id_fkey"
      columns: ["user_id","receivable_id"]
isOneToOne: false
      referencedRelation: "receivables"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"investment_subrules": {
                  Row: {
                    "account_id": string,"id": string,"pct_bps": number,"rule_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"id"?: string,"pct_bps": number,"rule_id": string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"id"?: string,"pct_bps"?: number,"rule_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "investment_subrules_user_id_account_id_fkey"
      columns: ["user_id","account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "investment_subrules_user_id_rule_id_fkey"
      columns: ["user_id","rule_id"]
isOneToOne: false
      referencedRelation: "distribution_rules"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"net_worth_snapshots": {
                  Row: {
                    "assets_cents": number,"id": string,"liabilities_cents": number,"net_worth_cents": number | null,"snapshot_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assets_cents": number,"id"?: string,"liabilities_cents": number,"net_worth_cents"?: never,"snapshot_on": string,"user_id"?: string
                  }
                  Update: {
                    "assets_cents"?: number,"id"?: string,"liabilities_cents"?: number,"net_worth_cents"?: never,"snapshot_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"receivables": {
                  Row: {
                    "card_account_id": string,"created_at": string,"debtor_id": string,"description": string,"id": string,"purchase_date": string,"term_months": number,"total_cents": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_account_id": string,"created_at"?: string,"debtor_id": string,"description": string,"id"?: string,"purchase_date": string,"term_months": number,"total_cents": number,"user_id"?: string
                  }
                  Update: {
                    "card_account_id"?: string,"created_at"?: string,"debtor_id"?: string,"description"?: string,"id"?: string,"purchase_date"?: string,"term_months"?: number,"total_cents"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receivables_user_id_card_account_id_fkey"
      columns: ["user_id","card_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "receivables_user_id_debtor_id_fkey"
      columns: ["user_id","debtor_id"]
isOneToOne: false
      referencedRelation: "debtors"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"recurring_expenses": {
                  Row: {
                    "amount_cents": number,"bucket": Database["public"]['Enums']["spend_bucket"],"charge_day": number,"created_at": string,"ended_on": string | null,"id": string,"name": string,"payment_account_id": string | null,"starts_on": string,"subcategory_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"bucket": Database["public"]['Enums']["spend_bucket"],"charge_day": number,"created_at"?: string,"ended_on"?: string | null,"id"?: string,"name": string,"payment_account_id"?: string | null,"starts_on": string,"subcategory_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"bucket"?: Database["public"]['Enums']["spend_bucket"],"charge_day"?: number,"created_at"?: string,"ended_on"?: string | null,"id"?: string,"name"?: string,"payment_account_id"?: string | null,"starts_on"?: string,"subcategory_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_expenses_user_id_payment_account_id_fkey"
      columns: ["user_id","payment_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["user_id","id"]
    },{
      foreignKeyName: "recurring_expenses_user_id_subcategory_id_fkey"
      columns: ["user_id","subcategory_id"]
isOneToOne: false
      referencedRelation: "subcategories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"subcategories": {
                  Row: {
                    "archived_at": string | null,"category_id": string,"icon": string | null,"id": string,"name": string,"name_key": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category_id": string,"icon"?: string | null,"id"?: string,"name": string,"name_key"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"category_id"?: string,"icon"?: string | null,"id"?: string,"name"?: string,"name_key"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subcategories_user_id_category_id_fkey"
      columns: ["user_id","category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["user_id","id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "collection_lead_days": number,"created_at": string,"emergency_fund_months": number,"first_payday": number,"green_min_bps": number,"save_surplus": boolean,"second_payday": number,"timezone": string,"updated_at": string,"user_id": string,"yellow_min_bps": number
                  }
                  ComputedFields: never
                  Insert: {
                    "collection_lead_days"?: number,"created_at"?: string,"emergency_fund_months"?: number,"first_payday"?: number,"green_min_bps"?: number,"save_surplus"?: boolean,"second_payday"?: number,"timezone"?: string,"updated_at"?: string,"user_id"?: string,"yellow_min_bps"?: number
                  }
                  Update: {
                    "collection_lead_days"?: number,"created_at"?: string,"emergency_fund_months"?: number,"first_payday"?: number,"green_min_bps"?: number,"save_surplus"?: boolean,"second_payday"?: number,"timezone"?: string,"updated_at"?: string,"user_id"?: string,"yellow_min_bps"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "ledger_entries": {
                  Row: {
                    "account_id": string | null,"amount_cents": number | null,"bucket": Database["public"]['Enums']["spend_bucket"] | null,"description": string | null,"entry_type": string | null,"id": string | null,"is_third_party": boolean | null,"occurred_on": string | null,"subcategory_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "check_income_allocations":
{ Args: { "p_income": string }; Returns: undefined
                           },
"check_receivable_installments":
{ Args: { "p_receivable": string }; Returns: undefined
                           },
"check_rule_subrules":
{ Args: { "p_rule": string }; Returns: undefined
                           },
"create_receivable":
{ Args: { "p_installments": Json,"p_receivable": Json }; Returns: string
                           },
"register_income":
{ Args: { "p_allocations": Json,"p_income": Json }; Returns: string
                           },
"replace_income":
{ Args: { "p_allocations": Json,"p_id": string,"p_income": Json }; Returns: string
                           },
"save_distribution_rule":
{ Args: { "p_rule": Json,"p_subrules": Json }; Returns: string
                           },
"update_account_with_installments":
{ Args: { "p_id": string,"p_installments": Json,"p_patch": Json }; Returns: {
              "archived_at": string | null,
"created_at": string,
"cut_off_day": number | null,
"id": string,
"institution": string | null,
"kind": Database["public"]['Enums']["account_kind"],
"name": string,
"opening_balance_cents": number,
"payment_due_offset_days": number | null,
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "accounts"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "account_kind": "checking"|"savings"|"credit_card"|"investment"|"cash","bucket_kind": "needs"|"wants"|"investment","expense_origin": "manual"|"recurring","goal_kind": "emergency_fund"|"sinking_fund"|"purchase","income_type": "salary"|"gift"|"debt_repayment"|"cashback"|"extra"|"sales"|"savings"|"investment_returns"|"other","installment_status": "pending"|"partial"|"collected","spend_bucket": "needs"|"wants"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_kind": ["checking", "savings", "credit_card", "investment", "cash"],"bucket_kind": ["needs", "wants", "investment"],"expense_origin": ["manual", "recurring"],"goal_kind": ["emergency_fund", "sinking_fund", "purchase"],"income_type": ["salary", "gift", "debt_repayment", "cashback", "extra", "sales", "savings", "investment_returns", "other"],"installment_status": ["pending", "partial", "collected"],"spend_bucket": ["needs", "wants"]
          }
        }
} as const
