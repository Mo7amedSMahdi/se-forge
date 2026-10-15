// MCP tools (decision 91). The rules cannot see what an MCP call does, so a project calls only the servers
// it names: Figma's (project.figma.toolPrefix) and policy.mcp.allow. Everything else is refused, including
// reading another server's resources.
import { deny } from './decision.mjs';

// Claude Code names a server's tools mcp__<server>__<tool>, with characters outside [A-Za-z0-9_-] as "_"
// (the server plugin:figma:figma gives mcp__plugin_figma_figma__).
export const serverPrefix = (server) => `mcp__${String(server).replace(/[^A-Za-z0-9_-]/g, '_')}__`;

const RESOURCE_TOOLS = new Set(['ListMcpResourcesTool', 'ReadMcpResourceTool']);

export function mcpFindings(input, ctx) {
  const tool = String(input.tool_name || '');
  const resource = RESOURCE_TOOLS.has(tool);
  if (!resource && !tool.startsWith('mcp__')) return [];
  const allowed = [ctx.project.figma.toolPrefix, ...ctx.config.mcp.allow].filter(Boolean);
  const server = input.tool_input?.server;
  const target = resource ? (server ? serverPrefix(server) : '') : tool;
  if (target && allowed.some((p) => target.startsWith(p))) return [];
  const what = resource ? `${tool} ${server ? `on server ${server}` : 'without naming an allowed server'}` : tool;
  return [deny('mcp:not-allowed', `${what} is not allowed in this project: the forge calls only the MCP servers the project names (${allowed.join(', ') || 'none'}). Use the project's own commands instead, or ask a person to add the server's prefix to policy.mcp.allow in project.json.`)];
}
