import { sanctionsOpenapi } from "@/lib/sanctions/openapi";
export const GET = () => Response.json(sanctionsOpenapi, { headers: { "Access-Control-Allow-Origin": "*" } });
