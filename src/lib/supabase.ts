import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 云端同步的客户端。
 *
 * ⚠️ 这里的 key 是 **publishable / anon（可公开）key**，Supabase 设计上就允许放前端、
 * 进仓库也安全——真正保护数据的是数据库的行级安全策略（本项目档位 A：公开可读写）。
 * **绝不要**把 service_role / secret key 放进这里或任何前端代码。
 *
 * 个人 API Key（如将来接 AI Agent 用的 Anthropic key）也**绝不**放这里——
 * 那类 key 只在运行时由用户填、存本机 localStorage，见 CLAUDE.md「云端同步方案」。
 */
export const SUPABASE_URL = "https://mqzvjrhfvjjuanjkwfsw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lnEmC16u5sk2ylhzpBx1rg_l3VQQCb0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
