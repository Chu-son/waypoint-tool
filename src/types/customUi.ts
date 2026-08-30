export interface CustomUiBrand {
  appName?: string;
  windowTitle?: string;
  icon?: string;
  logoUrl?: string;
  about?: {
    title?: string;
    description?: string;
    version?: string;
    company?: string;
  };
}

export interface CustomUiTheme {
  cssVariables?: Record<string, string>;
  customCssPath?: string;
}

export interface CustomUiTopMenuLayout {
  hiddenMenuLabels?: string[];
  hiddenItemIds?: string[];
}

export interface CustomUiToolPanelLayout {
  visibleTools?: Array<'select' | 'add_point' | 'add_generator' | 'add_rect_sweep' | 'add_export_region'>;
  allowImport?: boolean;
  allowExport?: boolean;
  allowSettings?: boolean;
}

export type CustomUiPanelTabType = 'builtin' | 'workflow' | 'html_file' | 'html_inline' | 'url';

export interface CustomUiPanelTabDef {
  type: CustomUiPanelTabType;
  id: string;
  title?: string;
  icon?: string;
  src?: string;
  url?: string;
  html?: string;
  css?: string;
}

export interface CustomUiPanelContainerLayout {
  defaultOpen?: boolean;
  defaultWidth?: number;
  viewMode?: 'tabs' | 'split';
  tabs?: CustomUiPanelTabDef[];
}

export interface CustomUiLayout {
  showWelcomeModal?: boolean;
  topMenu?: CustomUiTopMenuLayout;
  toolPanel?: CustomUiToolPanelLayout;
  leftPanel?: CustomUiPanelContainerLayout;
  rightPanel?: CustomUiPanelContainerLayout;
}

export interface StepLifecycleAction {
  name: string;
  args?: Record<string, any>;
}

export interface StepLifecycle {
  state?: Record<string, any>;
  actions?: Array<string | StepLifecycleAction>;
}

export interface WorkflowControlOption {
  label: string;
  value: any;
}

export interface WorkflowControl {
  type: 'slider' | 'select' | 'toggle' | 'number';
  label: string;
  target: {
    action: string;
  };
  min?: number;
  max?: number;
  step?: number;
  default?: any;
  options?: WorkflowControlOption[];
}

export type WorkflowButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type WorkflowButtonsLayout = 'column' | 'grid' | 'row';

export interface WorkflowActionButton {
  label: string;
  action: string;
  args?: Record<string, any>;
  variant?: WorkflowButtonVariant;
  icon?: string;
  description?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export interface WorkflowSimplifiedParamOption {
  label: string;
  value: any;
}

export interface WorkflowSimplifiedParam {
  paramKey: string;
  label: string;
  type: 'select' | 'slider' | 'number' | 'toggle';
  options?: WorkflowSimplifiedParamOption[];
  min?: number;
  max?: number;
  step?: number;
  default?: any;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  actionButton?: WorkflowActionButton;
  actionButtons?: WorkflowActionButton[];
  buttonsLayout?: WorkflowButtonsLayout;
  controls?: WorkflowControl[];
  pluginTarget?: string;
  simplifiedParams?: WorkflowSimplifiedParam[];
  onEnter?: StepLifecycle;
  onLeave?: StepLifecycle;
}

export interface CustomUiWorkflow {
  id: string;
  title: string;
  steps: WorkflowStep[];
}

export interface CustomUiConfig {
  $schema?: string;
  brand?: CustomUiBrand;
  theme?: CustomUiTheme;
  layout?: CustomUiLayout;
  workflow?: CustomUiWorkflow;
}
