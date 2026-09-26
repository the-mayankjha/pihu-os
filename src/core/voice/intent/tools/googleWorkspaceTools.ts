import type { ActionTool, ToolResult } from './types';

// Helper to run real Google API Client in Python
export const runGoogleApiClient = async (command: string, ...args: string[]): Promise<any> => {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { useSettingsStore } = await import('../../../../stores/settingsStore');

    const settings = useSettingsStore.getState();
    const cId = settings.googleClientId.trim();
    const cSecret = settings.googleClientSecret.trim();

    const envVars: Record<string, string> = {};
    if (cId) envVars.GOOGLE_CLIENT_ID = cId;
    if (cSecret) envVars.GOOGLE_CLIENT_SECRET = cSecret;

    const envPrefix = (cId && cSecret)
      ? `GOOGLE_CLIENT_ID='${cId.replace(/'/g, "\\'")}' GOOGLE_CLIENT_SECRET='${cSecret.replace(/'/g, "\\'")}' `
      : '';

    const pyArgs = [command, ...args].map(a => `'${a.replace(/'/g, "\\'")}'`).join(', ');
    const pyCmd = `${envPrefix}python3 -c "import os, sys, subprocess; script = next((p for p in ['pihu_mcps/mcp/servers/google_api_client.py', 'src-tauri/pihu_mcps/mcp/servers/google_api_client.py', '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps/mcp/servers/google_api_client.py'] if os.path.exists(p)), None); print(subprocess.check_output(['python3', script, ${pyArgs}]).decode('utf-8')) if script else print('{}')"`;
    
    const result = await invoke<string>('execute_shell_command', { command: pyCmd });
    if (result && result.trim().startsWith('{')) {
      return JSON.parse(result);
    }
    return { error: 'Invalid response from Google API client', raw: result };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
};

// ─── Google Workspace Tools (Real Live Gmail, Calendar, Docs, Drive, Tasks, Keep) ──

export const googleWorkspaceTools: ActionTool[] = [

  // ── GMAIL ──────────────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_search_emails',
      description: 'Searches user Gmail messages for keywords or queries using real Gmail API. Use when user says "search my emails for [query]", "check my inbox for [query]", "find email from [sender]", "list my unread emails".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'Query string to search in Gmail (e.g. "is:unread", "from:john", "subject:invoice").',
          },
          max_results: {
            type: 'NUMBER',
            description: 'Maximum number of email results to return (default 5).',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const query = args.query?.trim() || 'is:unread';
        const maxRes = args.max_results || 10;
        const apiRes = await runGoogleApiClient('search_gmail', query, String(maxRes));
        
        if (apiRes.error) {
          return { success: false, error: apiRes.error };
        }

        const count = apiRes.count || 0;
        const totalEstimated = apiRes.total_estimated || count;
        const messages = apiRes.messages || [];

        return {
          success: true,
          data: {
            action: 'searched_gmail',
            query,
            count: totalEstimated,
            showing_count: count,
            messages,
            message: totalEstimated > 0 
              ? `You have ${totalEstimated} unread email(s) in your Gmail inbox, Sir. Here are the top ${count}:\n` + messages.map((m: any) => `• ${m.subject} from ${m.sender} (${m.date})`).join('\n') + `\n\nWould you like me to read out the full content of any of these emails for you, Sir?`
              : `No emails matching "${query}" were found in your Gmail inbox, Sir.`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to search emails: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'google_workspace_notify_new_emails',
      description: 'Checks for new or unread Gmail messages using real Gmail API and prompts the user whether they would like to read it or open it. Use when user says "check for new emails", "do I have any new mail?", "notify me of new emails", "any unread emails?".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const apiRes = await runGoogleApiClient('search_gmail', 'is:unread', '10');
        if (apiRes.error) {
          return { success: false, error: apiRes.error };
        }

        const count = apiRes.count || 0;
        const totalEstimated = apiRes.total_estimated || count;
        const latest = apiRes.latest_email;

        if (totalEstimated === 0 || !latest) {
          return {
            success: true,
            data: {
              action: 'notified_unread_email',
              has_unread: false,
              count: 0,
              message: 'You have no unread emails in your Gmail inbox right now, Sir!',
            },
          };
        }

        return {
          success: true,
          data: {
            action: 'notified_unread_email',
            has_unread: true,
            count: totalEstimated,
            showing_count: count,
            email: latest,
            prompt: `You have ${totalEstimated} total unread email(s) in your Gmail, Sir. The latest is from ${latest.sender}: "${latest.subject}". Would you like me to read the entire email body for you, Sir?`,
            message: `You have ${totalEstimated} unread email(s) in your Gmail inbox, Sir. The latest email is from ${latest.sender}: "${latest.subject}". Would you like me to read out the full email body or open it in your browser, Sir?`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to check for new emails: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'google_workspace_read_or_open_email',
      description: 'Reads aloud an email content or opens it in the browser based on user choice. Use when user says "read it", "read the email", "open it", "open email in browser", "read mail".',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: {
            type: 'STRING',
            description: 'Action to perform: "read" (reads email aloud via voice) or "open" (opens Gmail in browser).',
          },
          email_id: {
            type: 'STRING',
            description: 'Optional email ID to read or open.',
          },
        },
        required: ['action'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const userAction = args.action.toLowerCase();
        const { invoke } = await import('@tauri-apps/api/core');

        if (userAction.includes('open')) {
          const mailUrl = 'https://mail.google.com/mail/u/0/#inbox';
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const cmd = isMac ? `open "${mailUrl}"` : `start "" "${mailUrl}"`;
          await invoke('execute_shell_command', { command: cmd });

          return {
            success: true,
            data: {
              action: 'opened_gmail_browser',
              url: mailUrl,
              message: 'Opened your Gmail inbox in your web browser!',
            },
          };
        } else {
          const apiRes = await runGoogleApiClient('get_unread_emails');
          const latest = apiRes?.latest_email;

          if (!latest) {
            return {
              success: true,
              data: {
                action: 'read_email_content',
                message: 'No unread email body was found to read aloud.',
              },
            };
          }

          return {
            success: true,
            data: {
              action: 'read_email_content',
              email: latest,
              read_aloud_text: `Email Subject: ${latest.subject}. Sender: ${latest.sender}. Summary snippet: ${latest.snippet}`,
              message: `Reading email aloud: "${latest.subject}" from ${latest.sender}. Snippet: ${latest.snippet}`,
            },
          };
        }
      } catch (e: any) {
        return { success: false, error: `Failed to read or open email: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'google_workspace_send_email',
      description: 'Sends a real email to a recipient via Gmail API. Use when user says "send an email to [email] with subject [subject] and body [body]", "email [recipient] [message]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          recipient: {
            type: 'STRING',
            description: 'Recipient email address (e.g. user@example.com).',
          },
          subject: {
            type: 'STRING',
            description: 'Subject line of the email.',
          },
          body: {
            type: 'STRING',
            description: 'Body content of the email message.',
          },
        },
        required: ['recipient', 'subject', 'body'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const apiRes = await runGoogleApiClient('send_email', args.recipient, args.subject, args.body);
        if (apiRes.error) {
          return { success: false, error: apiRes.error };
        }

        return {
          success: true,
          data: {
            action: 'sent_email_via_gmail_api',
            recipient: args.recipient,
            subject: args.subject,
            message_id: apiRes.message_id,
            message: `Successfully sent email to ${args.recipient} via Gmail API!`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to send email: ${e?.message || String(e)}` };
      }
    },
  },

  // ── GOOGLE CALENDAR ────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_list_calendar_events',
      description: 'Lists upcoming real events from Google Calendar API. Use when user says "what are my upcoming meetings?", "show my calendar events", "list my schedule for today".',
      parameters: {
        type: 'OBJECT',
        properties: {
          max_results: {
            type: 'NUMBER',
            description: 'Maximum number of events to fetch (default 5).',
          },
        },
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const maxResults = args?.max_results ? String(args.max_results) : '5';
        const apiRes = await runGoogleApiClient('list_calendar_events', maxResults);
        if (apiRes.error) {
          return { success: false, error: apiRes.error };
        }

        const events = apiRes.events || [];
        return {
          success: true,
          data: {
            action: 'listed_calendar_events',
            count: events.length,
            events,
            message: events.length > 0
              ? `Found ${events.length} upcoming calendar event(s):\n` + events.map((e: any) => `• ${e.summary} (${e.start})${e.hangoutLink ? ` [Meet: ${e.hangoutLink}]` : ''}`).join('\n')
              : 'You have no upcoming events on your Google Calendar!',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to list calendar events: ${e?.message || String(e)}` };
      }
    },
  },

  {
    declaration: {
      name: 'google_workspace_create_calendar_event',
      description: 'Creates a real Google Calendar event complete with a real Google Meet video call link using Calendar API. Use when user says "schedule a meeting [title] at [time]", "create calendar event [title]", "book meeting with Google Meet".',
      parameters: {
        type: 'OBJECT',
        properties: {
          summary: {
            type: 'STRING',
            description: 'Title or summary of the meeting/event.',
          },
          start_time: {
            type: 'STRING',
            description: 'Start time in ISO format or descriptive time string.',
          },
          end_time: {
            type: 'STRING',
            description: 'End time in ISO format or descriptive time string.',
          },
          description: {
            type: 'STRING',
            description: 'Optional description or agenda for the meeting.',
          },
        },
        required: ['summary'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const apiRes = await runGoogleApiClient('create_calendar_event', args.summary, args.start_time || '', args.end_time || '', args.description || '');
        if (apiRes.error) {
          return { success: false, error: apiRes.error };
        }

        return {
          success: true,
          data: {
            action: 'created_calendar_event',
            event_id: apiRes.event_id,
            summary: args.summary,
            google_meet_url: apiRes.google_meet_url,
            html_link: apiRes.html_link,
            message: `Scheduled "${args.summary}" on Google Calendar with real Google Meet link: ${apiRes.google_meet_url}`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to create calendar event: ${e?.message || String(e)}` };
      }
    },
  },

  // ── GOOGLE TASKS ───────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_manage_tasks',
      description: 'Lists or creates real tasks in Google Tasks API. Use when user says "list my tasks", "show my todo list", "add [task] to my Google tasks", "create task [task]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: {
            type: 'STRING',
            description: 'Action: "list" (fetch active tasks) or "create" (add a new task).',
          },
          title: {
            type: 'STRING',
            description: 'Title of task to create.',
          },
          due_date: {
            type: 'STRING',
            description: 'Due date if creating a task.',
          },
          notes: {
            type: 'STRING',
            description: 'Task notes or details.',
          },
        },
        required: ['action'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const taskAction = args.action.toLowerCase();
        if (taskAction === 'list') {
          const apiRes = await runGoogleApiClient('list_tasks');
          if (apiRes.error) return { success: false, error: apiRes.error };
          const tasks = apiRes.tasks || [];

          // Sync Google Tasks into local PIHU Task Store
          try {
            const { useTodoStore } = await import('../../../../widgets/todo/useTodoStore');
            const currentTodos = useTodoStore.getState().todos;
            tasks.forEach((gt: any) => {
              if (gt.title && !currentTodos.some(t => t.text.toLowerCase() === gt.title.toLowerCase())) {
                useTodoStore.getState().addTodo({
                  text: gt.title,
                  dueDate: gt.due,
                  project: 'Google Tasks',
                  priority: 'Medium'
                });
              }
            });
          } catch (e) {
            console.warn('[googleWorkspaceTools] Failed to sync Google Tasks locally:', e);
          }

          return {
            success: true,
            data: {
              action: 'listed_tasks',
              count: tasks.length,
              tasks,
              message: tasks.length > 0
                ? `You have ${tasks.length} task(s) in Google Tasks, Sir:\n` + tasks.map((t: any) => `• ${t.title}${t.due ? ` (Due: ${t.due})` : ''}`).join('\n')
                : 'Your Google Tasks list is currently empty, Sir!',
            },
          };
        } else {
          const title = args.title || 'New Task';
          const apiRes = await runGoogleApiClient('create_task', title, args.due_date || '', args.notes || '');
          if (apiRes.error) return { success: false, error: apiRes.error };

          // Sync task into local PIHU Tasks as well
          try {
            const { useTodoStore } = await import('../../../../widgets/todo/useTodoStore');
            useTodoStore.getState().addTodo({
              text: title,
              description: args.notes,
              dueDate: args.due_date,
              project: 'Google Tasks',
              priority: 'Medium'
            });
          } catch (e) {
            console.warn('[googleWorkspaceTools] Failed to add task to local store:', e);
          }

          return {
            success: true,
            data: {
              action: 'created_task',
              task_id: apiRes.task_id,
              title,
              message: `Created task "${title}" in Google Tasks and synced with your PIHU Task Manager, Sir!`,
            },
          };
        }
      } catch (e: any) {
        return { success: false, error: `Failed to manage tasks: ${e?.message || String(e)}` };
      }
    },
  },

  // ── GOOGLE KEEP & DOCS ─────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_create_doc',
      description: 'Creates a real Google Doc via Google Docs API. Use when user says "create a Google Doc titled [title]", "new document [title]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: {
            type: 'STRING',
            description: 'Title of the new document.',
          },
        },
        required: ['title'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const apiRes = await runGoogleApiClient('create_doc', args.title);
        if (apiRes.error) return { success: false, error: apiRes.error };
        return {
          success: true,
          data: {
            action: 'created_google_doc',
            document_id: apiRes.document_id,
            doc_url: apiRes.doc_url,
            message: `Created Google Doc "${args.title}": ${apiRes.doc_url}`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to create Google Doc: ${e?.message || String(e)}` };
      }
    },
  },

  // ── GOOGLE DRIVE ───────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_search_drive',
      description: 'Searches real files in Google Drive API. Use when user says "search Google Drive for [query]", "find file [name]".',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'File name or keyword query to search in Google Drive.',
          },
        },
        required: ['query'],
      },
    },
    execute: async (args): Promise<ToolResult> => {
      try {
        const apiRes = await runGoogleApiClient('search_drive', args.query);
        if (apiRes.error) return { success: false, error: apiRes.error };
        const files = apiRes.files || [];
        return {
          success: true,
          data: {
            action: 'searched_drive',
            query: args.query,
            count: files.length,
            files,
            message: files.length > 0
              ? `Found ${files.length} file(s) in Google Drive matching "${args.query}":\n` + files.map((f: any) => `• ${f.name}`).join('\n')
              : `No files found in Google Drive matching "${args.query}".`,
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to search Google Drive: ${e?.message || String(e)}` };
      }
    },
  },

  // ── LINK ACCOUNT ───────────────────────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_link_account',
      description: 'Launches Google OAuth2 authorization in the browser to link user Google Workspace account (Gmail, Calendar, Docs, Tasks, Keep, Drive). Use when user says "link my google account", "authorize google workspace", "connect google account", "login to google workspace".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useSettingsStore } = await import('../../../../stores/settingsStore');

        const settings = useSettingsStore.getState();
        const cId = settings.googleClientId.trim();
        const cSecret = settings.googleClientSecret.trim();

        if (!cId || !cSecret) {
          return {
            success: false,
            error: 'Google OAuth Client ID and Client Secret are missing! Please paste your Desktop Client ID and Secret in Settings -> Google Workspace tab first.'
          };
        }

        const startServerCmd = `python3 -c "import os, sys, subprocess; script = next((p for p in ['pihu_mcps/mcp/servers/google_oauth_server.py', 'src-tauri/pihu_mcps/mcp/servers/google_oauth_server.py', '/Users/mayankjha/Documents/projects/pihu-os/src-tauri/pihu_mcps/mcp/servers/google_oauth_server.py'] if os.path.exists(p)), None); subprocess.Popen(['python3', script, '${cId}', '${cSecret}']) if script else print('script not found')" > /tmp/google_oauth.log 2>&1 &`;
        await invoke('execute_shell_command', { command: startServerCmd });

        const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cId}&redirect_uri=http://localhost:8080/oauth2callback&response_type=code&scope=${scopes}&access_type=offline&prompt=select_account%20consent`;

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? `open "${authUrl}"` : `start "" "${authUrl}"`;

        await invoke('execute_shell_command', { command: cmd });
        settings.setGoogleWorkspaceConfig(cId, cSecret, true);

        return {
          success: true,
          data: {
            action: 'launched_google_oauth',
            auth_url: authUrl,
            message: 'Started local OAuth listener on port 8080 and opened Google authorization page in your browser. Please approve permissions to complete account linking!',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to launch Google authorization: ${e?.message || String(e)}` };
      }
    },
  },

  // ── RESET ACCOUNTS & CREDENTIALS ─────────────────────────────────────────
  {
    declaration: {
      name: 'google_workspace_reset_accounts',
      description: 'Resets, disconnects, and clears all linked Google Workspace accounts and removes all saved OAuth tokens and credentials. Use when user says "reset my google accounts", "reset google workspace", "disconnect all google accounts", "clear google credentials", "reset google workspace credentials".',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
    },
    execute: async (): Promise<ToolResult> => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { useSettingsStore } = await import('../../../../stores/settingsStore');

        const resetCmd = `python3 -c "import os; [os.remove(os.path.expanduser(f)) for f in ['~/.gemini/antigravity/google_workspace_tokens.json', '~/.gworkspace-mcp/credentials.json', '~/.config/google-workspace-mcp/credentials.json'] if os.path.exists(os.path.expanduser(f))]"`;
        await invoke('execute_shell_command', { command: resetCmd });

        const settings = useSettingsStore.getState();
        settings.setGoogleWorkspaceConfig('', '', false);
        useSettingsStore.setState({ connectedGoogleAccounts: [], googleAccountConnected: false });

        return {
          success: true,
          data: {
            action: 'reset_google_workspace',
            message: 'Successfully reset and disconnected all Google Workspace accounts and cleared all saved tokens and OAuth credentials.',
          },
        };
      } catch (e: any) {
        return { success: false, error: `Failed to reset Google Workspace: ${e?.message || String(e)}` };
      }
    },
  },

];
