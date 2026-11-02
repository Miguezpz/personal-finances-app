import { DEFAULT_USER_SETTINGS } from "@/domain/settings";
import type { UserSettings } from "@/domain/types";
import type { SettingsRepository } from "../../provider";
import type { AppSupabaseClient } from "../client";
import { fromSettings, toUserSettings } from "../mappers";
import { exec, execNullable } from "./query";

export function createSettingsRepository(db: AppSupabaseClient): SettingsRepository {
  return {
    async get(): Promise<UserSettings> {
      const row = await execNullable(db.from("user_settings").select("*").maybeSingle());
      // No row yet (before onboarding): the column defaults apply.
      return row ? toUserSettings(row) : DEFAULT_USER_SETTINGS;
    },

    async update(patch) {
      // Upsert on the primary key; user_id defaults to auth.uid() and RLS pins it to the caller.
      const row = await exec(
        db
          .from("user_settings")
          .upsert(fromSettings(patch), { onConflict: "user_id" })
          .select("*")
          .single(),
      );
      return toUserSettings(row);
    },
  };
}
