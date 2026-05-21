import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  FileText, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  Database,
  ArrowLeft,
  X,
  Lock,
  Calendar,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  connectGoogleDrive, 
  disconnectGoogleDrive, 
  getCachedDriveToken, 
  listGrajaFoodDriveFiles, 
  uploadBackupToDrive, 
  deleteDriveFile,
  DriveFile 
} from '../services/driveService';

interface DriveIntegrationProps {
  user: any;
  onBack: () => void;
  orders: any[];
  addresses: any[];
  stats: any;
  logsList: any[];
}

export default function DriveIntegration({ 
  user, 
  onBack, 
  orders = [], 
  addresses = [], 
  stats = null,
  logsList = [] 
}: DriveIntegrationProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Custom confirmation modal state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

  useEffect(() => {
    // Check if we are already authenticated in memory
    const existingToken = getCachedDriveToken();
    if (existingToken) {
      setToken(existingToken);
      fetchFiles(existingToken);
    }
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const liveToken = await connectGoogleDrive();
      setToken(liveToken);
      setSuccessMsg('Google Drive conectado com sucesso, mestre!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchFiles(liveToken);
    } catch (err: any) {
      setError(err?.message || 'Falha na autenticação com o Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setToken(null);
    setDriveFiles([]);
    setSuccessMsg('Google Drive desconectado.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const fetchFiles = async (currentToken: string) => {
    setIsRefreshing(true);
    setError(null);
    try {
      const files = await listGrajaFoodDriveFiles(currentToken);
      setDriveFiles(files);
    } catch (err: any) {
      setError(err?.message || 'Erro ao sincronizar arquivos do Google Drive.');
      // Keep token if alive, but if auth error, we might need to reconnect
      if (err?.message?.includes('auth') || err?.message?.includes('401') || err?.message?.includes('Invalid Credentials')) {
        setToken(null);
        disconnectGoogleDrive();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const executeDelete = async () => {
    if (!token || !confirmDeleteId) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDriveFile(token, confirmDeleteId);
      setSuccessMsg(`Arquivo "${confirmDeleteName}" removido com sucesso.`);
      setConfirmDeleteId(null);
      setConfirmDeleteName(null);
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchFiles(token);
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir o arquivo do Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  // --- TEMPLATE GENERATORS & UPLOAD HANDLERS ---

  const handleExportOrders = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const timestamp = new Date().toLocaleString('pt-BR');
      const filename = `GrajaFood_Pedidos_${user.nome.replace(/\s+/g, '_')}_${Date.now()}.md`;
      
      let markdown = `# Ficha de Backups GrajaFood — Histórico do Cliente\n`;
      markdown += `*Gerado automaticamente via API do Google Drive em ${timestamp}*\n\n`;
      markdown += `## Perfil do Usuário\n`;
      markdown += `- **Nome**: ${user.nome}\n`;
      markdown += `- **E-mail**: ${user.email}\n`;
      markdown += `- **Nível de Fidelidade**: ${user.nivel || 'Bronze'}\n`;
      markdown += `- **GrajaPontos Totais**: ${user.pontos || 0} XP\n\n`;

      markdown += `## Endereços Registrados\n`;
      if (addresses.length === 0) {
        markdown += `*Nenhum endereço cadastrado por este cliente.*\n\n`;
      } else {
        addresses.forEach((addr, i) => {
          markdown += `${i + 1}. ${addr.logradouro}, Nº ${addr.numero} - ${addr.bairro} ${addr.principal ? '**(Principal)**' : ''}\n`;
        });
        markdown += `\n`;
      }

      markdown += `## Histórico de Pedidos\n`;
      const clientOrders = orders.filter((o: any) => String(o.usuario_id) === String(user.id));
      if (clientOrders.length === 0) {
        markdown += `*Nenhum pedido realizado ainda. Venha provar os burgers da nossa comunidade!*\n`;
      } else {
        clientOrders.forEach((o: any) => {
          markdown += `### Pedido: ${o.id}\n`;
          markdown += `- **Restaurante**: ${o.restaurante_nome}\n`;
          markdown += `- **Total Pago**: R$ ${o.total.toFixed(2)} (Subtotal: R$ ${o.subtotal.toFixed(2)} + Taxa: R$ ${o.taxa.toFixed(2)})\n`;
          markdown += `- **Status**: \`${o.status?.toUpperCase()}\`\n`;
          markdown += `- **Pontos de Fidelidade Ganhos**: +${o.pontos_ganhos || 0} XP\n`;
          markdown += `- **Data**: ${new Date(o.criado_em).toLocaleDateString()} às ${new Date(o.criado_em).toLocaleTimeString()}\n`;
          markdown += `- **Endereço de Entrega**: ${o.endereco}\n`;
          markdown += `- **Itens do Pedido**:\n`;
          if (Array.isArray(o.itens)) {
            o.itens.forEach((it: any) => {
              markdown += `  - ${it.quantity}x **${it.nome}** (R$ ${it.preco.toFixed(2)} un.)\n`;
            });
          }
          markdown += `\n---\n\n`;
        });
      }

      await uploadBackupToDrive(token, filename, markdown);
      setSuccessMsg('Histórico de Pedidos exportado com sucesso para o Drive!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchFiles(token);
    } catch (err: any) {
      setError(err?.message || 'Erro ao exportar Histórico de Pedidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportStats = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const timestamp = new Date().toLocaleString('pt-BR');
      const filename = `GrajaFood_Relatorio_Faturamento_${Date.now()}.md`;
      const faturamentoTotal = stats?.faturamento || 0;
      const totalPedidos = stats?.pedidos || 0;
      const totalUsuarios = stats?.usuarios || 0;

      let markdown = `# Relatório Financeiro Executivo — GrajaFood Backoffice\n`;
      markdown += `*Sincronizado diretamente com a base do Cloud Firestore em ${timestamp}*\n\n`;
      markdown += `## Métricas Consolidadas de Performance\n`;
      markdown += `| Métrica | Valor Registrado |\n`;
      markdown += `| :--- | :--- |\n`;
      markdown += `| **Faturamento Total** | R$ ${faturamentoTotal.toFixed(2)} |\n`;
      markdown += `| **Volume de Pedidos** | ${totalPedidos} solicitações |\n`;
      markdown += `| **Usuários Cadastrados** | ${totalUsuarios} contas ativas |\n`;
      markdown += `| **Ticket Médio** | R$ ${totalPedidos > 0 ? (faturamentoTotal / totalPedidos).toFixed(2) : '0.00'} por pedido |\n\n`;

      markdown += `## Demonstrativo de Vendas Recentes\n`;
      if (orders.length === 0) {
        markdown += `*Nenhuma transação registrada na base recentemente.*\n`;
      } else {
        markdown += `| Código | Estabelecimento | Valor Total | Status do Fluxo | Data de Criação |\n`;
        markdown += `| :--- | :--- | :--- | :--- | :--- |\n`;
        orders.slice(0, 30).forEach((order: any) => {
          markdown += `| \`${order.id}\` | ${order.restaurante_nome} | R$ ${order.total.toFixed(2)} | \`${order.status?.toUpperCase()}\` | ${new Date(order.criado_em).toLocaleDateString()} |\n`;
        });
      }

      await uploadBackupToDrive(token, filename, markdown);
      setSuccessMsg('Painel Financeiro exportado com sucesso para o Drive!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchFiles(token);
    } catch (err: any) {
      setError(err?.message || 'Erro ao gerar e exportar relatório financeiro.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportLogs = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const timestamp = new Date().toLocaleString('pt-BR');
      const filename = `GrajaFood_Logs_Auditoria_${Date.now()}.md`;

      let markdown = `# Diário de Controle de Auditoria Interna — GrajaFood\n`;
      markdown += `*Exportação restrita e autorizada para Dono Master — Gerado em ${timestamp}*\n\n`;
      markdown += `## Informações de Segurança\n`;
      markdown += `- **Solicitante Master**: ${user.nome} (${user.email})\n`;
      markdown += `- **Nível**: ${user.tipo?.toUpperCase()}\n`;
      markdown += `- **Dispositivo Conectado**: GrajaFood Web Client (Port 3000 Security Portal)\n\n`;

      markdown += `--- \n\n`;
      markdown += `## Logs de Segurança Históricos\n`;
      markdown += `Este documento serve de registro pericial para controle administrativo do GrajaFood. Todas as modificações no estado dos usuários administradores e as permissões de operador estão anexadas abaixo.\n\n`;

      logsList.forEach((log, index) => {
        markdown += `### Registro ${index + 1}: ${log.acao}\n`;
        markdown += `- **Responsável (ID)**: \`${log.usuario_id || 'Serviço Central'}\`\n`;
        markdown += `- **Horário**: ${new Date(log.timestamp).toLocaleString()}\n`;
        markdown += `- **Descrição detalhada**: ${log.detalhes}\n`;
        markdown += `- **Assinatura Integra**: \`${log.id}\`\n\n`;
      });

      await uploadBackupToDrive(token, filename, markdown);
      setSuccessMsg('Logs de segurança exportados com sucesso!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchFiles(token);
    } catch (err: any) {
      setError(err?.message || 'Erro ao exportar logs de segurança.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-40">
      {/* Header section with elegant Back Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-neutral-100">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-black text-neutral-400 mb-4 hover:text-neutral-900 border border-neutral-100 px-4 py-2 rounded-xl bg-neutral-50 uppercase tracking-widest transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Perfil
          </button>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <HardDrive className="w-12 h-12 text-sky-500" /> Google Drive Hub
          </h1>
          <p className="text-neutral-400 font-semibold mt-2 uppercase tracking-widest text-[10px]">
            Sincronização e exportações de relatórios para o Grajaú
          </p>
        </div>

        {token && (
          <button
            onClick={handleDisconnect}
            className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all self-stretch md:self-auto text-center"
          >
            Desconectar Conta
          </button>
        )}
      </div>

      {/* Messaging area */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-100 text-red-700 p-5 rounded-3xl text-xs font-bold flex items-start gap-3 mb-8 shadow-sm"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <div>
              <p className="font-extrabold uppercase mb-1">ATENÇÃO PARCEIRO:</p>
              <p>{error}</p>
            </div>
          </motion.div>
        )}

        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-5 rounded-3xl text-xs font-bold flex items-center gap-3 mb-8 shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <p className="font-extrabold">{successMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main drive content */}
      {!token ? (
        <div className="bg-white p-12 md:p-16 rounded-[4rem] border border-neutral-100 shadow-xl text-center flex flex-col items-center max-w-2xl mx-auto">
          <div className="w-24 h-24 bg-sky-50 rounded-[2rem] flex items-center justify-center text-sky-500 mb-8 shadow-inner shadow-sky-100">
            <HardDrive className="w-12 h-12" />
          </div>
          
          <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-3">Conecte seu Google Drive</h2>
          <p className="text-neutral-400 font-medium text-sm max-w-md mb-10 leading-relaxed">
            Salve com total integridade os seus cupons fiscais do GrajaFood, relatórios de faturamento diários ou backups de segurança diretamente na nuvem de forma imediata e 100% transparente.
          </p>

          {/* Official Google Material Sign-In Button format as required by the privacy skill guidelines */}
          <button 
            onClick={handleConnect}
            disabled={loading}
            className="gsi-material-button w-full sm:w-auto min-w-[240px] shadow-lg shadow-neutral-100 hover:shadow-xl hover:scale-102 transition-all duration-300 select-none outline-none border-none py-1.5 px-4 bg-white rounded-2xl border border-neutral-200 flex items-center justify-center gap-3 cursor-pointer"
          >
            <div className="gsi-material-button-icon flex items-center">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '22px', height: '22px' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents font-black text-xs text-neutral-700 tracking-wider uppercase">
              {loading ? 'Sincronizando...' : 'Conectar com Google'}
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Action cards according to permissions */}
          <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
            <h3 className="text-2xl font-black uppercase tracking-tighter italic mb-8 flex items-center gap-2">
              <Lock className="w-5 h-5 text-sky-500" /> Exportações Disponíveis
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer orders export */}
              <div className="bg-neutral-50 p-8 rounded-[3rem] border border-neutral-100 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-sky-500 mb-6 shadow-sm">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight italic mb-2">Cupons de Pedido</h4>
                  <p className="text-xs text-neutral-400 font-medium leading-relaxed mb-8">
                    Gere um relatório pericial e completo contendo seus dados de fidelidade, endereços e todos os pedidos efetuados.
                  </p>
                </div>
                <button 
                  onClick={handleExportOrders}
                  disabled={loading}
                  className="w-full bg-neutral-900 hover:bg-sky-500 text-white font-black text-[10px] tracking-widest uppercase py-4 rounded-2xl shadow-xl hover:scale-101 active:scale-98 transition-all disabled:opacity-50"
                >
                  {loading ? 'Exportando...' : 'Exportar Histórico'}
                </button>
              </div>

              {/* Administrative Sales/Billing export - Visible to restaurateur and admin */}
              {['admin', 'dono_master', 'restaurante', 'operador', 'financeiro'].includes(user.tipo) && (
                <div className="bg-neutral-50 p-8 rounded-[3rem] border border-neutral-100 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-500 mb-6 shadow-sm">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h4 className="text-xl font-black uppercase tracking-tight italic mb-2">Painel de Faturamento</h4>
                    <p className="text-xs text-neutral-400 font-medium leading-relaxed mb-8">
                      Exporte as métricas de vendas consolidadas do GrajaFood (ticket médio, faturamento total, usuários) direto à nuvem.
                    </p>
                  </div>
                  <button 
                    onClick={handleExportStats}
                    disabled={loading || !stats}
                    className="w-full bg-neutral-900 hover:bg-sky-500 text-white font-black text-[10px] tracking-widest uppercase py-4 rounded-2xl shadow-xl hover:scale-101 active:scale-98 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Preparando planilha...' : 'Exportar Faturamento'}
                  </button>
                </div>
              )}

              {/* Security Logs auditing export - strictly restricted only to Dono Master */}
              {user.tipo === 'dono_master' && (
                <div className="bg-neutral-50 p-8 rounded-[3rem] border border-neutral-100 flex flex-col justify-between md:col-span-2">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 mb-6 shadow-sm">
                        <Database className="w-6 h-6" />
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-tight italic mb-2">Logs Internos de Auditoria</h4>
                      <p className="text-xs text-neutral-400 font-medium leading-relaxed mb-8 md:mb-0">
                        Exportação de alta segurança reservada aos administradores para fins forenses de compliance. Registra cadastros e controle de contas em conformidade com as Firestore Security Rules de GrajaFood.
                      </p>
                    </div>
                    <button 
                      onClick={handleExportLogs}
                      disabled={loading || logsList.length === 0}
                      className="bg-neutral-900 hover:bg-sky-500 text-white font-black text-[10px] tracking-widest uppercase px-8 py-5 rounded-2xl shadow-xl hover:scale-101 active:scale-98 transition-all disabled:opacity-50 md:self-center min-w-[200px]"
                    >
                      {loading ? 'Compactando logs...' : 'Gravar Logs no Drive'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Existings Backups on drive */}
          <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-sky-500" /> Backups de GrajaFood no Drive
                </h3>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mt-1">
                  Arquivos na nuvem gerenciados pela nossa aplicação
                </p>
              </div>
              <button 
                onClick={() => fetchFiles(token)}
                disabled={isRefreshing}
                className="flex items-center gap-2 text-[10px] font-black border border-neutral-100 hover:bg-neutral-50 px-4 py-2.5 rounded-xl text-neutral-500 uppercase tracking-widest transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Sincronizar
              </button>
            </div>

            {driveFiles.length === 0 ? (
              <div className="text-center py-16 bg-neutral-50/50 rounded-[3rem] border-2 border-dashed border-neutral-100">
                <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-400 font-extrabold uppercase tracking-wider text-[10px] mb-2">
                  {isRefreshing ? 'Sincronizando com o Google Drive...' : 'Nenhum backup de GrajaFood encontrado.'}
                </p>
                <p className="text-xs text-neutral-400 font-semibold max-w-xs mx-auto">
                  Clique nas opções de exportação acima para salvar seu primeiro relatório pericial na nuvem!
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                {driveFiles.map(file => {
                  const isStats = file.name.includes('Faturamento');
                  const isLogs = file.name.includes('Logs');
                  return (
                    <div 
                      key={file.id}
                      className="bg-neutral-50 p-6 rounded-[2.5rem] border border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 ${
                          isStats ? 'bg-emerald-50 text-emerald-500' : isLogs ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'
                        }`}>
                          {isStats ? <FileSpreadsheet className="w-6 h-6" /> : isLogs ? <Database className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-neutral-900 group-hover:text-sky-500 transition-colors truncate uppercase text-sm leading-tight italic">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-neutral-400 font-extrabold uppercase mt-1 tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {file.createdTime ? new Date(file.createdTime).toLocaleString() : 'Sem data registrada'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                        {file.webViewLink && (
                          <a 
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer referrer"
                            className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 p-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                            title="Abrir no Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button 
                          onClick={() => {
                            setConfirmDeleteId(file.id);
                            setConfirmDeleteName(file.name);
                          }}
                          className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 p-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                          title="Remover Backup do Drive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Structured Confirmation Dialog to guarantee safety constraints */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full p-10 rounded-[4rem] shadow-2xl border border-neutral-100 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <h4 className="text-2xl font-black uppercase tracking-tighter italic mb-3 text-neutral-900 leading-tight">
                Excluir arquivo do Drive?
              </h4>
              <p className="text-neutral-400 font-medium text-xs leading-relaxed mb-8">
                Tem certeza que deseja excluir permanentemente o arquivo <span className="font-extrabold text-neutral-800 wrap truncate block mt-1">"{confirmDeleteName}"</span> do seu Google Drive? Esta ação é irreversível.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setConfirmDeleteId(null);
                    setConfirmDeleteName(null);
                  }}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 py-4.5 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  className="bg-neutral-900 hover:bg-red-600 text-white py-4.5 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-lg hover:shadow-red-500/20"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
