import { capabilityRegistry } from '../../../capabilities/capabilityRegistry';
import { useVoiceStore } from '../../../../stores/voiceStore';
import { invoke } from '@tauri-apps/api/core';
import type { ActionTool } from './types';
import { draftGoogleDoc, draftProjectGoogleDoc } from '../../../services/googleDocDraft';
import { readGmailSubject } from '../../../services/gmailRead';
import { openMcpConfiguration } from '../../../services/mcpNavigation';

export const workflowTools: ActionTool[] = [
  {
    declaration: {name: 'workflow_coding_task', description: 'Execute a software implementation or code-change task in the active project. Use only for actual coding, not document writing or Google Workspace operations.', parameters: {type: 'OBJECT', properties: {instructions: {type: 'STRING'}}, required: ['instructions']}},
    execute: async args => {
      const matched = await capabilityRegistry.resolve({prompt: args.instructions});
      if (!matched) return {success: false, error: 'No coding capability supports this request.'};
      const result = await matched.capability.execute({taskId: crypto.randomUUID(), prompt: args.instructions, onProgress: event => {
        const store = useVoiceStore.getState();
        if (event.type === 'status') store.setProcessingStatus(event.message);
        else if (event.type === 'coding.plan.created') store.setActiveCodingPlan(event.data);
        else if (event.type === 'coding.file.changed') store.setActiveFileChange(event.data);
        else if (event.type === 'coding.completed') store.setActiveCodingReport(event.data);
      }});
      return {success: true, data: result};
    },
  },
  {
    declaration: { name: 'workflow_draft_document', description: 'Generate a full document and open an editable preview. Use for any request to create/write/draft a document. Does not upload. The user reviews and clicks Create Google Doc. Choose project source only for an active-project analysis.', parameters: { type: 'OBJECT', properties: { title: {type: 'STRING'}, instructions: {type: 'STRING'}, source: {type: 'STRING', enum: ['knowledge', 'project']} }, required: ['title', 'instructions', 'source'] } },
    execute: async (args, context) => ({success: true, data: {message: args.source === 'project' ? await draftProjectGoogleDoc(args.instructions, args.title, context?.signal) : await draftGoogleDoc(args.instructions, args.title, context?.signal)}}),
  },
  {
    declaration: { name: 'workflow_read_email', description: 'Find an email by subject and decode/read its body. Returns matching alternatives when ambiguous. Attachment contents are not supported.', parameters: {type: 'OBJECT', properties: {subject: {type: 'STRING'}}, required: ['subject']} },
    execute: async args => ({success: true, data: {message: await readGmailSubject(args.subject)}}),
  },
  {
    declaration: { name: 'workflow_mcp_catalog', description: 'List MCP packages, latest published versions and installed versions. Resolve exact IDs here before install/update/configuration.', parameters: {type: 'OBJECT', properties: {}} },
    execute: async () => {
      const response = await fetch('https://pihu.nfks.co.in/api/v2/catalog?type=mcp&limit=100', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}`);
      const data = await response.json();
      const installed = await invoke<Array<{id: string; version?: string; enabled?: boolean}>>('mcp_list_installed');
      return {success: true, data: {packages: data.packages, installed}};
    },
  },
  {
    declaration: {name: 'workflow_manage_mcp', description: 'Install/update an optional MCP package by exact catalog ID, or open its configuration. Install/update preserves saved accounts. Do not report completion before the tool succeeds.', parameters: {type: 'OBJECT', properties: {package_id: {type: 'STRING'}, action: {type: 'STRING', enum: ['install','update','configure','diagnose','enable','disable']}}, required: ['package_id','action']}},
    execute: async args => {
      if (args.action === 'configure') { openMcpConfiguration(args.package_id); return {success: true, data: {message: 'Opened MCP configuration'}}; }
      const result = ['install','update'].includes(args.action) ? await invoke<string>('mcp_install_package', {packageId: args.package_id}) : await invoke<string>('mcp_manage_package', {packageId: args.package_id, action: args.action, configuration: null});
      if (['install','update'].includes(args.action)) openMcpConfiguration(args.package_id);
      return {success: true, data: {message: result}};
    },
  },
];
