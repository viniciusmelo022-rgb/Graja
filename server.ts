import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'grajafood_secret_dev';

// Enable trust proxy for rate limiting behind reverse proxies (AI Studio)
app.set('trust proxy', 1);

// Database setup with fallback for preview environment
const hasDb = !!process.env.DATABASE_URL;
const pool = hasDb ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

// Mock database for when DATABASE_URL is not provided
const mockDb = {
  usuarios: [],
  restaurantes: [
    {
      id: 1, nome: "Graja Burger", descricao: "O melhor burger do fundão", categoria: "Lanches",
      logo_url: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=200",
      pedido_minimo: 20, tempo_preparo: 30, avaliacao_media: 4.8, total_avaliacoes: 156,
      logradouro: "Av. Dona Belmira Marin", bairro: "Grajaú", latitude: -23.75, longitude: -46.68
    },
    {
      id: 2, nome: "Pizzaria São José", descricao: "Tradicional no bairro desde 1995", categoria: "Pizza",
      logo_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200",
      pedido_minimo: 35, tempo_preparo: 45, avaliacao_media: 4.5, total_avaliacoes: 89,
      logradouro: "Rua Jequitibatá", bairro: "Parque Residencial Cocaia", latitude: -23.76, longitude: -46.69
    }
  ],
  produtos: [],
  pedidos: []
};

// ── Helpers ──────────────────────────────────────────────────
const db = async (text: string, params: any[] = []) => {
  if (pool) return pool.query(text, params);
  console.warn("DB Mock Mode: Operação simulada em memória.");
  return { rows: [] };
};

const gerarToken = (payload: any) => jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const autenticar = (req: any, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido.' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
};

const permitir = (...tipos: string[]) => (req: any, res: Response, next: NextFunction) => {
  if (!tipos.includes(req.usuario.tipo))
    return res.status(403).json({ erro: 'Acesso não autorizado.' });
  next();
};

const calcularTaxaEntrega = (distanciaKm: number) => {
  if (distanciaKm > 11) return null; // fora da área
  return distanciaKm <= 1.5 ? 6.50 : 6.50 + (distanciaKm - 1.5) * 2.00;
};

// ── Middlewares ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabling for local preview compatibility
}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// ── API Routes ───────────────────────────────────────────────

interface Usuario {
  id: number;
  nome: string;
  email: string;
  hash: string;
  telefone?: string;
  tipo: 'dono_master' | 'admin' | 'operador' | 'financeiro' | 'suporte' | 'restaurante' | 'entregador' | 'cliente';
  permissoes?: Record<string, string[]>; // e.g. { 'pedidos': ['ver', 'editar'], 'financeiro': ['ver'] }
  ativo: boolean;
  pontos?: number;
  nivel?: string;
}

interface Convite {
  token: string;
  email: string;
  tipo: Usuario['tipo'];
  permissoes: Record<string, string[]>;
  criado_em: string;
}

interface Log {
  id: number;
  usuario_id: number;
  acao: string;
  detalhes: string;
  timestamp: string;
}

// In-memory sessions storage for the demo (resets on server restart)
const store = {
  usuarios: [
    { 
      id: 1, 
      nome: "Dono Master", 
      email: "master@grajafood.com", 
      hash: "", // to be hashed
      tipo: "dono_master" as const,
      ativo: true,
      permissoes: { '*': ['*'] } // Master has all
    }
  ] as Usuario[],
  restaurantes: [
    {
      id: 1, nome: "Graja Burger", descricao: "O melhor burger do fundão", categoria: "Lanches",
      logo_url: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600",
      pedido_minimo: 20, tempo_preparo: 30, avaliacao_media: 4.8, total_avaliacoes: 156,
      logradouro: "Av. Dona Belmira Marin", bairro: "Grajaú", latitude: -23.75, longitude: -46.68
    },
    {
      id: 2, nome: "Pizzaria São José", descricao: "Tradicional no bairro desde 1995", categoria: "Pizza",
      logo_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",
      pedido_minimo: 35, tempo_preparo: 45, avaliacao_media: 4.5, total_avaliacoes: 89,
      logradouro: "Rua Jequitibatá", bairro: "Parque Residencial Cocaia", latitude: -23.76, longitude: -46.69
    }
  ],
  produtos: [
    { id: 1, restaurante_id: 1, nome: "X-Graja", descricao: "Hambúrguer, queijo, presunto, ovo, bacon e muito amor", preco: 25.90, categoria: "Burger" },
    { id: 2, restaurante_id: 1, nome: "Batata do Fundão", descricao: "Batata frita com cheddar e bacon", preco: 18.00, categoria: "Acompanhamentos" },
    { id: 3, restaurante_id: 2, nome: "Pizza de Calabresa", descricao: "Massa artesanal, calabresa, cebola e azeitona", preco: 45.00, categoria: "Pizza" }
  ] as any[],
  pedidos: [] as any[],
  enderecos: [] as any[],
  cupons: [
    { codigo: 'GRAJA10', valor: 10, pedido_minimo: 30 },
    { codigo: 'PRIMEIRACOMPRA', valor: 15, pedido_minimo: 40 }
  ],
  convites: [] as Convite[],
  logs: [] as Log[]
};

// Auto-hash master pass
bcrypt.hash("master123", 12).then(h => store.usuarios[0].hash = h);

const registrarLog = (usuario_id: number, acao: string, detalhes: string) => {
  store.logs.push({
    id: Date.now(),
    usuario_id,
    acao,
    detalhes,
    timestamp: new Date().toISOString()
  });
};

const checkPermissao = (usuario: any, modulo: string, acao: string) => {
  if (usuario.tipo === 'dono_master') return true;
  const p = usuario.permissoes?.[modulo] || [];
  return p.includes(acao) || p.includes('*');
};

const calcularPontos = (total: number) => Math.floor(total);

// AUTH
const authRouter = express.Router();
authRouter.post('/registro', async (req, res) => {
  const { nome, email, senha, telefone, tipo } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios.' });
  
  // Security: Prevent unauthorized admin creation
  const rolesProibidas = ['admin', 'dono_master', 'operador', 'financeiro', 'suporte'];
  if (rolesProibidas.includes(tipo)) {
    return res.status(403).json({ erro: 'Cadastro deste tipo de usuário deve ser feito via convite do Dono Master.' });
  }

  const hash = await bcrypt.hash(senha, 12);
  const newUser: Usuario = { 
    id: Date.now(), 
    nome, 
    email, 
    hash, 
    telefone, 
    tipo: tipo || 'cliente',
    ativo: true,
    pontos: 0,
    nivel: 'Bronze'
  };
  store.usuarios.push(newUser);
  
  registrarLog(newUser.id, 'REGISTRO', `Novo usuário ${newUser.tipo} registrado`);
  
  const { hash: _, ...userPublic } = newUser;
  res.status(201).json({ token: gerarToken(userPublic), usuario: userPublic });
});

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const user = store.usuarios.find(u => u.email === email && u.ativo);
  if (!user) return res.status(401).json({ erro: 'Credenciais inválidas ou conta inativa.' });
  
  const ok = await bcrypt.compare(senha, user.hash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

  registrarLog(user.id, 'LOGIN', 'Login realizado com sucesso');

  const { hash: _, ...userPublic } = user;
  res.json({ token: gerarToken(userPublic), usuario: userPublic });
});

// INVITATION FLOW
authRouter.post('/convidar', autenticar, (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Apenas Dono Master pode convidar.' });
  
  const { email, tipo, permissoes } = req.body;
  const token = Math.random().toString(36).substring(2, 15);
  
  const convite: Convite = {
    token,
    email,
    tipo,
    permissoes,
    criado_em: new Date().toISOString()
  };
  
  store.convites.push(convite);
  registrarLog(req.usuario.id, 'CONVITE_ENVIADO', `Convite enviado para ${email} como ${tipo}`);
  
  res.json({ token, msg: 'Convite gerado com sucesso. Envie o link ao usuário.' });
});

authRouter.post('/aceitar-convite', async (req, res) => {
  const { token, senha, nome, telefone } = req.body;
  const idx = store.convites.findIndex(c => c.token === token);
  if (idx === -1) return res.status(400).json({ erro: 'Convite inválido ou expirado.' });
  
  const convite = store.convites[idx];
  const hash = await bcrypt.hash(senha, 12);
  
  const newUser: Usuario = {
    id: Date.now(),
    nome,
    email: convite.email,
    hash,
    telefone,
    tipo: convite.tipo,
    permissoes: convite.permissoes,
    ativo: true,
    pontos: 0,
    nivel: 'Iniciante'
  };
  
  store.usuarios.push(newUser);
  store.convites.splice(idx, 1);
  
  registrarLog(newUser.id, 'CONVITE_ACEITO', `Usuário ${convite.email} aceitou o convite`);
  
  const { hash: _, ...userPublic } = newUser;
  res.json({ token: gerarToken(userPublic), usuario: userPublic });
});

authRouter.get('/perfil', autenticar, (req: any, res) => {
  res.json(req.usuario);
});
app.use('/api/auth', authRouter);

// ADMIN GESTÃO
const adminGestaoRouter = express.Router();
adminGestaoRouter.use(autenticar);

adminGestaoRouter.get('/usuarios', (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  res.json(store.usuarios.map(({ hash, ...u }) => u));
});

adminGestaoRouter.get('/convites', (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  res.json(store.convites);
});

adminGestaoRouter.patch('/usuarios/:id', (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  const user = store.usuarios.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  
  Object.assign(user, req.body);
  registrarLog(req.usuario.id, 'USUARIO_EDITADO', `Editado usuário ${user.email}`);
  res.json(user);
});

adminGestaoRouter.get('/logs', (req: any, res) => {
  if (!checkPermissao(req.usuario, 'logs', 'ver')) return res.status(403).json({ erro: 'Sem permissão.' });
  res.json(store.logs.sort((a,b) => b.id - a.id).slice(0, 50));
});

app.use('/api/admin_gestao', adminGestaoRouter);

// RESTAURANTES & PRODUTOS
const restRouter = express.Router();
restRouter.get('/', (req, res) => {
  res.json(store.restaurantes);
});

restRouter.get('/:id', (req, res) => {
  const restId = parseInt(req.params.id);
  const r = store.restaurantes.find(item => item.id === restId);
  if (!r) return res.status(404).json({ erro: "Restaurante não encontrado" });
  
  const produtos = store.produtos.filter(p => p.restaurante_id === restId);
  res.json({ ...r, produtos });
});

// Admin/Restaurant Product Management
restRouter.post('/:id/produtos', autenticar, permitir('restaurante', 'admin'), (req: any, res) => {
  const restId = parseInt(req.params.id);
  const { nome, descricao, preco, categoria } = req.body;
  const newProd = { id: Date.now(), restaurante_id: restId, nome, descricao, preco, categoria };
  store.produtos.push(newProd);
  res.status(201).json(newProd);
});

app.use('/api/restaurantes', restRouter);

// PEDIDOS
const pedidoRouter = express.Router();
pedidoRouter.post('/', autenticar, (req: any, res) => {
  const { restaurante_id, itens, endereco, subtotal, taxa, total, forma_pagamento } = req.body;
  
  const rest = store.restaurantes.find(r => r.id === restaurante_id);
  const newPedido = {
    id: `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    usuario_id: req.usuario.id,
    restaurante_id,
    restaurante_nome: rest?.nome,
    restaurante_logo: rest?.logo_url,
    itens,
    endereco,
    subtotal,
    taxa,
    total,
    forma_pagamento,
    status: 'recebido',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    pontos_ganhos: calcularPontos(total)
  };
  
  // Update user points
  const user = store.usuarios.find(u => u.id === req.usuario.id);
  if (user) {
    user.pontos = (user.pontos || 0) + newPedido.pontos_ganhos;
    if (user.pontos > 5000) user.nivel = 'Diamante';
    else if (user.pontos > 1500) user.nivel = 'Ouro';
    else if (user.pontos > 500) user.nivel = 'Prata';
  }
  
  store.pedidos.push(newPedido);
  res.status(201).json(newPedido);
});

pedidoRouter.get('/', autenticar, (req: any, res) => {
  let userPedidos = [];
  if (req.usuario.tipo === 'admin') {
    userPedidos = store.pedidos;
  } else if (req.usuario.tipo === 'restaurante') {
    userPedidos = store.pedidos.filter(p => p.restaurante_id === 1); 
  } else {
    userPedidos = store.pedidos.filter(p => p.usuario_id === req.usuario.id);
  }
  res.json(userPedidos.slice().reverse());
});

pedidoRouter.patch('/:id/status', autenticar, (req: any, res) => {
  const pedido = store.pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
  
  pedido.status = req.body.status;
  pedido.atualizado_em = new Date().toISOString();
  res.json(pedido);
});

app.use('/api/pedidos', pedidoRouter);

// DASHBOARD / STATS
app.get('/api/admin/stats', autenticar, permitir('admin', 'restaurante'), (req: any, res) => {
  const totalFaturamento = store.pedidos.reduce((acc, p) => acc + p.total, 0);
  const totalPedidos = store.pedidos.length;
  const totalUsuarios = store.usuarios.length;
  
  res.json({
    faturamento: totalFaturamento,
    pedidos: totalPedidos,
    usuarios: totalUsuarios,
    recentOrders: store.pedidos.slice(-5).reverse()
  });
});

// ENDEREÇOS
app.post('/api/enderecos', autenticar, (req: any, res) => {
  const newEnd = { id: Date.now(), usuario_id: req.usuario.id, ...req.body, principal: store.enderecos.filter(e => e.usuario_id === req.usuario.id).length === 0 };
  store.enderecos.push(newEnd);
  res.status(201).json(newEnd);
});

app.get('/api/enderecos', autenticar, (req: any, res) => {
  res.json(store.enderecos.filter(e => e.usuario_id === req.usuario.id));
});

app.patch('/api/enderecos/:id/principal', autenticar, (req: any, res) => {
  const id = parseInt(req.params.id);
  store.enderecos.forEach(e => {
    if (e.usuario_id === req.usuario.id) {
      e.principal = e.id === id;
    }
  });
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', size: store.usuarios.length, env: process.env.NODE_ENV }));

// ── Vite Integration ─────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GrajaFood API rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
