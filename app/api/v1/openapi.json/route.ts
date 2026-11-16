import { openapi } from "@/lib/openapi";
export const GET = () => Response.json(openapi, { headers: { "Access-Control-Allow-Origin": "*" } });
