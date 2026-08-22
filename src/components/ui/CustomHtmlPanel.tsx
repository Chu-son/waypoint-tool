import { useEffect, useRef, useState } from 'react';
import { CustomUiPanelTabDef } from '../../types/customUi';
import { BackendAPI } from '../../api';
import { executeWorkflowAction } from '../../utils/workflowActions';
import { useAppStore } from '../../stores/appStore';

interface CustomHtmlPanelProps {
  tabDef: CustomUiPanelTabDef;
}

export function CustomHtmlPanel({ tabDef }: CustomHtmlPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [srcDoc, setSrcDoc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (tabDef.type === 'html_inline') {
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>${tabDef.css || ''}</style>
        </head>
        <body>
          ${tabDef.html || ''}
        </body>
        </html>
      `;
      setSrcDoc(fullHtml);
    } else if (tabDef.type === 'html_file' && tabDef.src) {
      BackendAPI.readTextFile(tabDef.src)
        .then((content) => {
          setSrcDoc(content);
        })
        .catch((err) => {
          console.error(`Failed to load custom HTML from ${tabDef.src}:`, err);
          setSrcDoc(`<div style="color:red;padding:1rem;">Failed to load HTML file: ${err}</div>`);
        });
    }
  }, [tabDef.type, tabDef.src, tabDef.html, tabDef.css]);

  // PostMessage Bridge listener
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'WAYPOINT_ACTION' && event.data.action) {
        await executeWorkflowAction(event.data.action, event.data.args);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Broadcast store updates to iframe
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const waypoints = useAppStore((state) => state.nodes);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'WAYPOINT_TOOL_STATE_UPDATE',
          selectedNodeIds,
          waypointCount: waypoints.length,
        },
        '*'
      );
    }
  }, [selectedNodeIds, waypoints.length]);

  if (tabDef.type === 'url' && tabDef.url) {
    return (
      <iframe
        ref={iframeRef}
        src={tabDef.url}
        className="w-full h-full border-0 bg-surface-base"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={tabDef.title || 'Custom Web Panel'}
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      className="w-full h-full border-0 bg-surface-base"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      title={tabDef.title || 'Custom HTML Panel'}
    />
  );
}
