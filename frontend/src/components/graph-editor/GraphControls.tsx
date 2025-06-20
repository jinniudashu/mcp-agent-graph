// src/components/graph-editor/GraphControls.tsx  
import React, { useState, useEffect } from 'react';
import { 
  Button, Modal, Form, Input, Select, Tooltip, message, Space, Radio, 
  Upload, Divider, Row, Col, Dropdown, Menu, Card
} from 'antd';
import {
  PlusOutlined, SaveOutlined, CodeOutlined, CopyOutlined, CheckOutlined,
  DeleteOutlined, InfoCircleOutlined, ImportOutlined, ExportOutlined,
  RobotOutlined, DownOutlined, FileTextOutlined, UploadOutlined, QuestionCircleOutlined,
  InboxOutlined, SettingOutlined, ThunderboltOutlined, FolderOpenOutlined,
  BranchesOutlined, ToolOutlined, PartitionOutlined, BulbOutlined, RocketOutlined
} from '@ant-design/icons';
import { useGraphEditorStore } from '../../store/graphEditorStore';
import { useMCPStore } from '../../store/mcpStore';
import { useModelStore } from '../../store/modelStore';
import ServerStatusIndicator from './ServerStatusIndicator';
import SmartPromptEditor from '../common/SmartPromptEditor';
import * as graphService from '../../services/graphService';
import MarkdownRenderer from '../common/MarkdownRenderer';
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

interface GraphControlsProps {
  onAddNode: () => void;
  addNodeBtnRef?: React.RefObject<HTMLButtonElement>; // 添加这个可选参数
}

const GraphControls: React.FC<GraphControlsProps> = ({ onAddNode, addNodeBtnRef }) => {
  // Configure message component for better visibility
  const [messageApi, contextHolder] = message.useMessage();

  const {
    currentGraph,
    saveGraph,
    graphs,
    loadGraph,
    createNewGraph,
    renameGraph,
    dirty,
    generateMCPScript,
    deleteGraph,
    importGraph,
    importGraphFromFile,
    exportGraph,
    importGraphPackage,
    importGraphPackageFromFile,
    generateGraph,
    getGraphReadme,
    updateGraphProperties,
    autoLayout
  } = useGraphEditorStore();

  const { config, status, fetchConfig, fetchStatus } = useMCPStore();
  const { models, fetchModels } = useModelStore();

  const [loading, setLoading] = useState(false);
  const [newGraphModalVisible, setNewGraphModalVisible] = useState(false);
  const [mcpScriptModalVisible, setMcpScriptModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [aiGenerateModalVisible, setAiGenerateModalVisible] = useState(false);
  const [aiOptimizeModalVisible, setAiOptimizeModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [readmeModalVisible, setReadmeModalVisible] = useState(false);
  const [graphSettingsModalVisible, setGraphSettingsModalVisible] = useState(false);
  const [promptTemplateModalVisible, setPromptTemplateModalVisible] = useState(false);
  const [optimizePromptTemplateModalVisible, setOptimizePromptTemplateModalVisible] = useState(false);

  const [mcpScript, setMcpScript] = useState("");
  const [parallelScript, setParallelScript] = useState("");
  const [sequentialScript, setSequentialScript] = useState("");
  const [scriptType, setScriptType] = useState<'sequential' | 'parallel'>('sequential');
  const [copied, setCopied] = useState(false);
  const [readmeContent, setReadmeContent] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [optimizePromptTemplate, setOptimizePromptTemplate] = useState("");
  const [importType, setImportType] = useState<'json' | 'zip'>('json');
  const [importMethod, setImportMethod] = useState<'path' | 'file'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [aiOptimizeForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  // 获取当前图的所有节点名称用于终止输出模板引用
  const getAvailableNodesForTemplate = () => {
    if (!currentGraph) return [];
    
    // 获取所有节点名称，包括特殊节点
    const nodeNames = currentGraph.nodes.map(n => n.name);
    const specialNodes = ['start'];
    
    // 合并并去重
    const allNodes = [...new Set([...specialNodes, ...nodeNames])];
    
    return allNodes.sort();
  };

  // 添加初始化数据获取
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          fetchConfig(),
          fetchStatus(),
          fetchModels()
        ]);
      } catch (error) {
        console.error('初始化数据获取失败:', error);
        messageApi.error('初始化数据获取失败');
      }
    };

    initializeData();

    // Set up a timer to periodically refresh status
    const statusInterval = setInterval(() => {
      fetchStatus();
    }, 30000); // Refresh status every 30 seconds

    return () => {
      clearInterval(statusInterval);
    };
  }, [fetchConfig, fetchStatus, fetchModels]);

  // Check if all MCP servers used in the current graph are connected
  const checkServerConnections = () => {
    if (!currentGraph || !config.mcpServers) return true;

    const connectedServers = Object.entries(status)
      .filter(([_, serverStatus]) => serverStatus?.connected)
      .map(([name]) => name);

    const hasDisconnectedServer = currentGraph.nodes.some(node => {
      if (!node.mcp_servers || node.mcp_servers.length === 0) return false;
      return node.mcp_servers.some(server => !connectedServers.includes(server));
    });

    return !hasDisconnectedServer;
  };

  const handleSave = async () => {
    if (!currentGraph) return;

    try {
      setLoading(true);
      await saveGraph();
      messageApi.success(`图 "${currentGraph.name}" 保存成功`);
    } catch (error) {
      messageApi.error(`保存失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewGraph = () => {
    form.resetFields();
    setNewGraphModalVisible(true);
  };

  const handleNewGraphSubmit = async () => {
    try {
      const values = await form.validateFields();
      createNewGraph(values.name, values.description);
      setNewGraphModalVisible(false);
      messageApi.success(`图 "${values.name}" 创建成功`);
    } catch (error) {
      // Form validation error
    }
  };

  const handleGraphChange = (graphName: string) => {
    if (dirty) {
      Modal.confirm({
        title: '未保存的更改',
        content: '当前图有未保存的更改。切换图将丢失这些更改。是否继续？',
        onOk: () => {
          loadGraph(graphName);
        }
      });
    } else {
      loadGraph(graphName);
    }
  };

  const handleDeleteGraph = async () => {
    if (!currentGraph) return;

    try {
      setLoading(true);
      await deleteGraph(currentGraph.name);
      setDeleteModalVisible(false);
      messageApi.success(`图 "${currentGraph.name}" 删除成功`);
    } catch (error) {
      messageApi.error(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportMCP = async () => {
    if (!currentGraph) return;

    try {
      setLoading(true);

      if (dirty) {
        await saveGraph();
        messageApi.success(`图 "${currentGraph.name}" 自动保存成功`);
      }

      const response = await generateMCPScript(currentGraph.name);

      setSequentialScript(response.sequential_script || response.default_script || response.script || "");
      setParallelScript(response.parallel_script || "");
      setMcpScript(response.sequential_script || response.default_script || response.script || "");
      setScriptType('sequential');

      setMcpScriptModalVisible(true);
    } catch (error) {
      messageApi.error(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyScript = () => {
    const scriptToCopy = scriptType === 'parallel' ? parallelScript : sequentialScript;

    navigator.clipboard.writeText(scriptToCopy).then(() => {
      setCopied(true);
      messageApi.success('脚本已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // AI生成图功能
  const handleAiGenerate = async () => {
    try {
      const values = await aiForm.validateFields();
      setLoading(true);
      
      const result = await generateGraph(values.requirement, values.model_name);
      setAiGenerateModalVisible(false);
      aiForm.resetFields();
      
      messageApi.success(`图 "${result.graph_name}" 生成成功`);
      
      // 加载生成的图
      if (result.graph_name) {
        loadGraph(result.graph_name);
      }
    } catch (error) {
      messageApi.error(`生成失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // AI优化图功能
  const handleAiOptimize = async () => {
    try {
      const values = await aiOptimizeForm.validateFields();
      setLoading(true);
      
      const result = await graphService.optimizeGraph({
        graph_name: currentGraph!.name,
        optimization_requirement: values.optimization_requirement,
        model_name: values.model_name
      });
      
      setAiOptimizeModalVisible(false);
      aiOptimizeForm.resetFields();
      
      if (result.status === 'success') {
        messageApi.success(`图优化成功！新图名称: "${result.optimized_graph_name}"`);
        
        // 加载优化后的图
        if (result.optimized_graph_name) {
          loadGraph(result.optimized_graph_name);
        }
      } else {
        messageApi.error(`优化失败: ${result.message}`);
      }
    } catch (error) {
      messageApi.error(`优化失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 导入功能
  const handleImport = async () => {
    try {
      setLoading(true);

      let result;
      if (importMethod === 'file') {
        // 文件上传方式
        if (!selectedFile) {
          messageApi.error('请选择要导入的文件');
          return;
        }

        if (importType === 'json') {
          result = await importGraphFromFile(selectedFile);
        } else {
          result = await importGraphPackageFromFile(selectedFile);
        }
      } else {
        // 路径输入方式
        const values = await importForm.validateFields();
        if (importType === 'json') {
          result = await importGraph(values.file_path);
        } else {
          result = await importGraphPackage(values.file_path);
        }
      }

      setImportModalVisible(false);
      importForm.resetFields();
      setSelectedFile(null);
      messageApi.success(result.message);

      // 显示额外信息
      if (result.needs_api_key && result.needs_api_key.length > 0) {
        messageApi.warning(`以下模型需要配置API密钥: ${result.needs_api_key.join(', ')}`);
      }
      if (result.skipped_models && result.skipped_models.length > 0) {
        messageApi.info(`跳过了已存在的模型: ${result.skipped_models.join(', ')}`);
      }
      if (result.skipped_servers && result.skipped_servers.length > 0) {
        messageApi.info(`跳过了已存在的服务器: ${result.skipped_servers.join(', ')}`);
      }
    } catch (error) {
      messageApi.error(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    return false; // 阻止自动上传
  };

  // 处理导入类型变化
  const handleImportTypeChange = (type: 'json' | 'zip') => {
    setImportType(type);
    setSelectedFile(null);
    importForm.resetFields();
  };

  // 处理导入方式变化
  const handleImportMethodChange = (method: 'path' | 'file') => {
    setImportMethod(method);
    setSelectedFile(null);
    importForm.resetFields();
  };

  // 导出图功能
  const handleExport = async () => {
    if (!currentGraph) return;

    try {
      setLoading(true);
      const result = await exportGraph(currentGraph.name);
      messageApi.success(`图 "${currentGraph.name}" 导出成功`);
      messageApi.info(`导出文件路径: ${result.file_path}`);
    } catch (error) {
      messageApi.error(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 查看README
  const handleViewReadme = async () => {
    if (!currentGraph) return;

    try {
      setLoading(true);
      const result = await getGraphReadme(currentGraph.name);
      setReadmeContent(result.readme);
      setReadmeModalVisible(true);
    } catch (error) {
      messageApi.error(`获取README失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取AI生成提示词模板
  const handleGetPromptTemplate = async () => {
    try {
      setLoading(true);
      const result = await graphService.getPromptTemplate();
      setPromptTemplate(result.prompt);
      setPromptTemplateModalVisible(true);
    } catch (error) {
      messageApi.error(`获取提示词模板失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 获取AI优化提示词模板
  const handleGetOptimizePromptTemplate = async () => {
    try {
      setLoading(true);
      const request = currentGraph?.name ? { graph_name: currentGraph.name } : undefined;
      const result = await graphService.getOptimizePromptTemplate(request);
      
      if (result.status === 'error') {
        messageApi.error(`获取优化提示词模板失败: ${result.message}`);
        return;
      }
      
      setOptimizePromptTemplate(result.prompt);
      setOptimizePromptTemplateModalVisible(true);
    } catch (error) {
      messageApi.error(`获取优化提示词模板失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 图设置
  const handleGraphSettings = () => {
    if (currentGraph) {
      settingsForm.setFieldsValue({
        name: currentGraph.name,
        description: currentGraph.description || "",
        end_template: currentGraph.end_template || ""
      });
      setGraphSettingsModalVisible(true);
    }
  };

  const handleUpdateGraphSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      updateGraphProperties(values);
      setGraphSettingsModalVisible(false);
      messageApi.success('图设置更新成功');
    } catch (error) {
      // Form validation error
    }
  };

  // 自动布局功能
  const handleAutoLayout = () => {
    if (!currentGraph || currentGraph.nodes.length === 0) {
      messageApi.warning('当前图中没有节点');
      return;
    }

    try {
      autoLayout();
      messageApi.success('节点自动布局完成');
    } catch (error) {
      messageApi.error(`自动布局失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Server status check
  const allServersConnected = checkServerConnections();

  // 快速操作菜单
  const quickActionsMenu = (
    <Menu>
      <Menu.Item key="new" icon={<PlusOutlined />} onClick={handleCreateNewGraph}>
        新建图
      </Menu.Item>
      <Menu.Item key="ai-generate" icon={<ThunderboltOutlined />} onClick={() => setAiGenerateModalVisible(true)}>
        AI生成图
      </Menu.Item>
      <Menu.Item key="ai-generate-prompt" icon={<BulbOutlined />} onClick={handleGetPromptTemplate}>
        AI生成提示词
      </Menu.Item>
      <Menu.Item 
        key="ai-optimize-prompt" 
        icon={<FileTextOutlined />} 
        onClick={handleGetOptimizePromptTemplate}
        disabled={!currentGraph?.name}
      >
        AI优化提示词
      </Menu.Item>
    </Menu>
  );

  // 导入导出菜单
  const importExportMenu = (
    <Menu>
      <Menu.Item key="import-json" icon={<ImportOutlined />} onClick={() => {
        setImportType('json');
        setImportMethod('file');
        setSelectedFile(null);
        setImportModalVisible(true);
      }}>
        导入JSON图
      </Menu.Item>
      <Menu.Item key="import-zip" icon={<ImportOutlined />} onClick={() => {
        setImportType('zip');
        setImportMethod('file');
        setSelectedFile(null);
        setImportModalVisible(true);
      }}>
        导入压缩包
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item 
        key="export" 
        icon={<ExportOutlined />} 
        onClick={handleExport}
        disabled={!currentGraph?.name}
      >
        导出压缩包
      </Menu.Item>
    </Menu>
  );

  // 更多操作菜单
  const moreMenu = (
    <Menu>
      <Menu.Item 
        key="auto-layout" 
        icon={<PartitionOutlined />} 
        onClick={handleAutoLayout}
        disabled={!currentGraph?.name || currentGraph.nodes.length === 0}
      >
        自动布局
      </Menu.Item>
      <Menu.Item 
        key="ai-optimize" 
        icon={<RocketOutlined />} 
        onClick={() => setAiOptimizeModalVisible(true)}
        disabled={!currentGraph?.name}
      >
        AI优化图
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item 
        key="readme" 
        icon={<FileTextOutlined />} 
        onClick={handleViewReadme}
        disabled={!currentGraph?.name}
      >
        查看README
      </Menu.Item>
      <Menu.Item 
        key="settings" 
        icon={<SettingOutlined />} 
        onClick={handleGraphSettings}
        disabled={!currentGraph?.name}
      >
        图设置
      </Menu.Item>
      <Menu.Item 
        key="export-mcp" 
        icon={<CodeOutlined />} 
        onClick={handleExportMCP}
        disabled={!currentGraph?.name}
      >
        导出MCP
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item 
        key="delete" 
        icon={<DeleteOutlined />} 
        onClick={() => setDeleteModalVisible(true)}
        disabled={!currentGraph?.name}
        danger
      >
        删除图
      </Menu.Item>
    </Menu>
  );

  return (
    <div style={{ 
      padding: '1px 1px 1px 1px', 
      background: '#fafafa',
      borderBottom: '1px solid #e8e8e8',
      marginBottom: '16px'
    }}>
      {contextHolder}
      
      {/* 主工具栏 */}
      <div style={{
        background: 'white',
        padding: '12px 12px',
        borderRadius: '6px'
      }}>
        <Row justify="space-between" align="middle" gutter={16}>
          {/* 左侧：图选择和快速操作 */}
          <Col flex="auto">
            <Space size="middle">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpenOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                <Select
                  placeholder="选择图"
                  style={{ width: 200 }}
                  onChange={handleGraphChange}
                  value={currentGraph?.name}
                  size="middle"
                >
                  {graphs.map(name => (
                    <Option key={name} value={name}>{name}</Option>
                  ))}
                </Select>
                
                <Dropdown overlay={quickActionsMenu} trigger={['click']} placement="bottomLeft">
                  <Button size="middle" type="text">
                    <PlusOutlined /> <DownOutlined />
                  </Button>
                </Dropdown>
              </div>

              <Divider type="vertical" />

              <Button
                ref={addNodeBtnRef} // 使用传入的 ref
                type="primary"
                icon={<PlusOutlined />}
                onClick={onAddNode}
                disabled={!currentGraph}
                size="middle"
              >
                添加节点
              </Button>

              <Tooltip title="根据节点层级关系自动排列节点位置">
                <Button
                  icon={<PartitionOutlined />}
                  onClick={handleAutoLayout}
                  disabled={!currentGraph?.name || currentGraph.nodes.length === 0}
                  size="middle"
                >
                  自动布局
                </Button>
              </Tooltip>

              <Dropdown overlay={importExportMenu} trigger={['click']}>
                <Button size="middle">
                  <ImportOutlined /> 导入/导出 <DownOutlined />
                </Button>
              </Dropdown>

              <ServerStatusIndicator />
            </Space>
          </Col>

          {/* 右侧：保存和操作 */}
          <Col>
            <Space size="middle">
              <Tooltip title={!allServersConnected ? "图包含使用断开连接服务器的节点" : ""}>
                <Button
                  type={dirty ? "primary" : "default"}
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={loading}
                  disabled={!currentGraph || !dirty}
                  danger={!allServersConnected}
                  size="middle"
                >
                  {dirty ? '保存' : '已保存'}
                </Button>
              </Tooltip>

              <Dropdown overlay={moreMenu} trigger={['click']} placement="bottomRight">
                <Button icon={<SettingOutlined />} size="middle">
                  <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Create new graph modal */}
      <Modal
        title="创建新图"
        open={newGraphModalVisible}
        onOk={handleNewGraphSubmit}
        onCancel={() => setNewGraphModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="图名称"
            rules={[
              { required: true, message: '请输入图名称' },
              { pattern: /^[^./\\]+$/, message: '名称不能包含特殊字符 (/, \\, .)' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Generate modal */}
      <Modal
        title="AI生成图"
        open={aiGenerateModalVisible}
        onOk={handleAiGenerate}
        onCancel={() => setAiGenerateModalVisible(false)}
        width={600}
        confirmLoading={loading}
      >
        <Form form={aiForm} layout="vertical">
          <Form.Item
            name="requirement"
            label="需求描述"
            rules={[{ required: true, message: '请描述您的需求' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="详细描述您希望创建的图的功能和需求..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="model_name"
            label="生成模型"
            rules={[{ required: true, message: '请选择生成用的模型' }]}
          >
            <Select placeholder="选择模型" loading={!models || models.length === 0}>
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          {/* 添加模型状态提示 */}
          {(!models || models.length === 0) && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#fff7e6', 
              border: '1px solid #ffd591',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ad6800'
            }}>
              <InfoCircleOutlined style={{ marginRight: '4px' }} />
              暂无可用模型，请先在"模型管理"页面添加模型配置
            </div>
          )}
        </Form>
      </Modal>

      {/* AI Optimize modal */}
      <Modal
        title="AI优化图"
        open={aiOptimizeModalVisible}
        onOk={handleAiOptimize}
        onCancel={() => setAiOptimizeModalVisible(false)}
        width={600}
        confirmLoading={loading}
      >
        <Form form={aiOptimizeForm} layout="vertical">
          <Form.Item
            label="当前图"
          >
            <Input value={currentGraph?.name} disabled />
          </Form.Item>

          <Form.Item
            name="optimization_requirement"
            label="优化需求"
            rules={[{ required: true, message: '请描述您的优化需求' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="描述您希望如何优化这个图，例如：提高性能、改进可读性、优化流程等..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item
            name="model_name"
            label="优化模型"
            rules={[{ required: true, message: '请选择优化用的模型' }]}
          >
            <Select placeholder="选择模型" loading={!models || models.length === 0}>
              {models.map(model => (
                <Option key={model.name} value={model.name}>{model.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          {/* 添加模型状态提示 */}
          {(!models || models.length === 0) && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#fff7e6', 
              border: '1px solid #ffd591',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ad6800'
            }}>
              <InfoCircleOutlined style={{ marginRight: '4px' }} />
              暂无可用模型，请先在"模型管理"页面添加模型配置
            </div>
          )}
        </Form>
      </Modal>

      {/* Import modal */}
      <Modal
        title={importType === 'json' ? "导入JSON图" : "导入压缩包"}
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false);
          setSelectedFile(null);
          importForm.resetFields();
        }}
        confirmLoading={loading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 导入类型选择 */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>导入类型</div>
            <Radio.Group 
              value={importType} 
              onChange={(e) => handleImportTypeChange(e.target.value)}
              optionType="button" 
              buttonStyle="solid"
            >
              <Radio.Button value="json">JSON图配置</Radio.Button>
              <Radio.Button value="zip">压缩包(ZIP)</Radio.Button>
            </Radio.Group>
          </div>

          {/* 导入方式选择 */}
          <div>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>导入方式</div>
            <Radio.Group 
              value={importMethod} 
              onChange={(e) => handleImportMethodChange(e.target.value)}
            >
              <Radio value="file">选择文件上传</Radio>
              <Radio value="path">输入文件路径</Radio>
            </Radio.Group>
          </div>

          {/* 条件渲染：文件上传或路径输入 */}
          {importMethod === 'file' ? (
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>选择文件</div>
              <Dragger
                name="file"
                multiple={false}
                accept={importType === 'json' ? '.json' : '.zip'}
                beforeUpload={handleFileChange}
                onRemove={() => setSelectedFile(null)}
                fileList={selectedFile ? [{
                  uid: '1',
                  name: selectedFile.name,
                  status: 'done',
                  size: selectedFile.size,
                }] : []}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  点击或拖拽{importType === 'json' ? 'JSON' : 'ZIP'}文件到此区域上传
                </p>
                <p className="ant-upload-hint">
                  {importType === 'json' 
                    ? '支持单个JSON图配置文件' 
                    : '支持单个ZIP图包文件，包含配置、模型、服务器等信息'
                  }
                </p>
              </Dragger>
            </div>
          ) : (
            <Form form={importForm} layout="vertical">
              <Form.Item
                name="file_path"
                label={
                  <span>
                    文件路径{' '}
                    <Tooltip title="请输入服务器上的文件绝对路径">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true, message: '请输入文件路径' }]}
              >
                <Input 
                  placeholder={importType === 'json' ? "输入JSON文件路径" : "输入ZIP文件路径"}
                />
              </Form.Item>
            </Form>
          )}

          {/* 文件格式说明 */}
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#f6f8fa', 
            borderRadius: '6px',
            fontSize: '12px',
            color: '#666'
          }}>
            {importType === 'json' ? (
              <div>
                <strong>JSON格式说明：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>仅包含图配置信息</li>
                  <li>不包含依赖的模型和服务器配置</li>
                  <li>需要手动配置所需的模型和MCP服务器</li>
                </ul>
              </div>
            ) : (
              <div>
                <strong>ZIP包说明：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>包含完整的图配置、依赖模型和MCP服务器信息</li>
                  <li>自动导入相关配置（跳过已存在的）</li>
                  <li>导入的模型可能需要重新配置API密钥</li>
                </ul>
              </div>
            )}
          </div>
        </Space>
      </Modal>

      {/* Graph Settings modal */}
      <Modal
        title="图设置"
        open={graphSettingsModalVisible}
        onOk={handleUpdateGraphSettings}
        onCancel={() => setGraphSettingsModalVisible(false)}
        width={900}
        bodyStyle={{ 
          minHeight: '720px',
          paddingBottom: '60px'
        }}
      >
        <Form form={settingsForm} layout="vertical">
          <Form.Item
            name="name"
            label="图名称"
            rules={[
              { required: true, message: '请输入图名称' },
              { pattern: /^[^./\\]+$/, message: '名称不能包含特殊字符 (/, \\, .)' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="图描述"
          >
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item
            name="end_template"
            label={
              <span>
                终止输出模板{' '}
                <Tooltip title="支持{node_name}格式引用其他节点的输出，输入 { 可以快速选择节点">
                  <QuestionCircleOutlined />
                </Tooltip>
              </span>
            }
            style={{ marginBottom: '80px' }}
          >
            <SmartPromptEditor
              placeholder="例如：{node1}的输出是：{node1_output}，{node2}的输出是：{node2_output}"
              rows={8}
              availableNodes={getAvailableNodesForTemplate()}
              size="large"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        title="删除图"
        open={deleteModalVisible}
        onOk={handleDeleteGraph}
        onCancel={() => setDeleteModalVisible(false)}
        okText="删除"
        okButtonProps={{ danger: true }}
        confirmLoading={loading}
      >
        {currentGraph && (
          <p>
            确定要删除图 "{currentGraph.name}" 吗？此操作不可撤销。
          </p>
        )}
      </Modal>

      {/* README modal */}
      <Modal
        title={`README - ${currentGraph?.name}`}
        open={readmeModalVisible}
        onCancel={() => setReadmeModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setReadmeModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1000}
        bodyStyle={{ padding: 0 }}
      >
        <MarkdownRenderer
          content={readmeContent}
          title={`README - ${currentGraph?.name}`}
          showCopyButton={true}
          showPreview={true}
          style={{ border: 'none', boxShadow: 'none' }}
        />
      </Modal>

      {/* AI生成提示词模板 modal */}
      <Modal
        title="AI生成提示词模板"
        open={promptTemplateModalVisible}
        onCancel={() => setPromptTemplateModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPromptTemplateModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1000}
        bodyStyle={{ padding: 0 }}
      >
        <MarkdownRenderer
          content={promptTemplate}
          title="AI图生成提示词模板"
          showCopyButton={true}
          showPreview={true}
          style={{ border: 'none', boxShadow: 'none' }}
        />
      </Modal>

      {/* AI优化提示词模板 modal */}
      <Modal
        title="AI优化提示词模板"
        open={optimizePromptTemplateModalVisible}
        onCancel={() => setOptimizePromptTemplateModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setOptimizePromptTemplateModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={1000}
        bodyStyle={{ padding: 0 }}
      >
        <MarkdownRenderer
          content={optimizePromptTemplate}
          title={`AI优化提示词模板${currentGraph ? ` - ${currentGraph.name}` : ''}`}
          showCopyButton={true}
          showPreview={true}
          style={{ border: 'none', boxShadow: 'none' }}
        />
      </Modal>

      {/* MCP script modal with script type selector */}
      <Modal
        title="MCP服务器脚本"
        open={mcpScriptModalVisible}
        onCancel={() => setMcpScriptModalVisible(false)}
        width={800}
        footer={[
          <Button key="copy" icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={handleCopyScript}>
            {copied ? '已复制' : '复制脚本'}
          </Button>,
          <Button key="close" onClick={() => setMcpScriptModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Radio.Group
            value={scriptType}
            onChange={(e) => {
              setScriptType(e.target.value);
              setMcpScript(e.target.value === 'parallel' ? parallelScript : sequentialScript);
            }}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="sequential">串行执行</Radio.Button>
            <Radio.Button value="parallel">并行执行</Radio.Button>
          </Radio.Group>
          <Tooltip title={scriptType === 'parallel' ?
            "并行执行会根据依赖级别尽可能并行运行节点" :
            "串行执行按依赖顺序逐个运行节点"}>
            <InfoCircleOutlined style={{ marginLeft: '8px' }} />
          </Tooltip>
        </div>

        <div className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          <pre>{mcpScript}</pre>
        </div>
      </Modal>
    </div>
  );
};

export default GraphControls;