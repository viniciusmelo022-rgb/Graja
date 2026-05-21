import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from "./src/firebaseAdminCompat";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase App & Firestore
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

// Lazy initialize GoogleGenAI to handle missing API keys gracefully at start
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[GrajaFood IA] GEMINI_API_KEY desconfigurada. Executando em modo de simulação íntegra.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'grajafood_secret_dev';

app.set('trust proxy', 1);

// Helpers
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
  if (req.usuario.tipo === 'dono_master' || tipos.includes(req.usuario.tipo)) {
    return next();
  }
  return res.status(403).json({ erro: 'Acesso não autorizado.' });
};

const calcularTaxaEntrega = (distanciaKm: number) => {
  if (distanciaKm > 11) return null; // fora da área
  return distanciaKm <= 1.5 ? 6.50 : 6.50 + (distanciaKm - 1.5) * 2.00;
};

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(express.json({ limit: '5mb' }));

let limiter: any;
try {
  const limiterFunc = (rateLimit as any).rateLimit || rateLimit;
  if (typeof limiterFunc === 'function') {
    limiter = limiterFunc({ windowMs: 15 * 60 * 1000, max: 200 });
  } else {
    limiter = (req: any, res: any, next: any) => next();
  }
} catch (e) {
  limiter = (req: any, res: any, next: any) => next();
}
app.use('/api/', limiter);

// Log Helper
const registrarLog = async (usuario_id: any, acao: string, detalhes: string) => {
  try {
    const logId = String(Date.now() + Math.floor(Math.random() * 1000));
    await setDoc(doc(db, "logs", logId), {
      id: logId,
      usuario_id: String(usuario_id),
      acao,
      detalhes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro ao gravar log no Firestore:", error);
  }
};

const checkPermissao = (usuario: any, modulo: string, acao: string) => {
  if (usuario.tipo === 'dono_master') return true;
  const p = usuario.permissoes?.[modulo] || [];
  return p.includes(acao) || p.includes('*');
};

const calcularPontos = (total: number) => Math.floor(total);

// ── Seeding ──────────────────────────────────────────────────
async function preseedFirestore() {
  try {
    const rSnap = await getDocs(collection(db, "restaurants"));
    if (rSnap.empty) {
      console.log("[GrajaFood Fire Seeding] Présemeando restaurantes no Firestore...");
      
      // Graja Burger
      await setDoc(doc(db, "restaurants", "1"), {
        id: "1",
        nome: "Graja Burger",
        descricao: "O melhor burger do fundão",
        categoria: "Lanches",
        logo_url: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600",
        pedido_minimo: 20,
        tempo_preparo: 30,
        avaliacao_media: 4.8,
        total_avaliacoes: 156,
        logradouro: "Av. Dona Belmira Marin",
        bairro: "Grajaú"
      });

      await setDoc(doc(db, "restaurants", "1", "products", "1"), {
        id: "1",
        restaurante_id: "1",
        nome: "X-Graja",
        descricao: "Hambúrguer, queijo, presunto, ovo, bacon e muito amor",
        preco: 25.90,
        categoria: "Burger"
      });

      await setDoc(doc(db, "restaurants", "1", "products", "2"), {
        id: "2",
        restaurante_id: "1",
        nome: "Batata do Fundão",
        descricao: "Batata frita com cheddar e bacon",
        preco: 18.00,
        categoria: "Acompanhamentos"
      });

      // Pizzaria São José
      await setDoc(doc(db, "restaurants", "2"), {
        id: "2",
        nome: "Pizzaria São José",
        descricao: "Tradicional no bairro desde 1995",
        categoria: "Pizza",
        logo_url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600",
        pedido_minimo: 35,
        tempo_preparo: 45,
        avaliacao_media: 4.5,
        total_avaliacoes: 89,
        logradouro: "Rua Jequitibatá",
        bairro: "Parque Residencial Cocaia"
      });

      await setDoc(doc(db, "restaurants", "2", "products", "3"), {
        id: "3",
        restaurante_id: "2",
        nome: "Pizza de Calabresa",
        descricao: "Massa artesanal, calabresa, cebola e azeitona",
        preco: 45.00,
        categoria: "Pizza"
      });

      console.log("[GrajaFood Fire Seeding] Restaurantes pré-semeados com sucesso!");
    }

    // Seed Master Admin
    const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", "master@grajafood.com")));
    if (uSnap.empty) {
      console.log("[GrajaFood Fire Seeding] Criando usuário Dono Master no Firestore...");
      const masterHash = bcrypt.hashSync("master123", 12);
      await setDoc(doc(db, "users", "1"), {
        id: "1",
        nome: "Dono Master",
        email: "master@grajafood.com",
        hash: masterHash,
        tipo: "dono_master",
        ativo: true,
        pontos: 0,
        nivel: "Master"
      });
      console.log("[GrajaFood Fire Seeding] Usuário Dono Master criado!");
    }
  } catch (error) {
    console.error("Falha no pré-semeamento do Firestore:", error);
  }
}

// ── API Routes ───────────────────────────────────────────────

const authRouter = express.Router();

authRouter.post('/registro', async (req, res) => {
  const { nome, email, senha, telefone, tipo } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios.' });

  const rolesProibidas = ['admin', 'dono_master', 'operador', 'financeiro', 'suporte'];
  if (rolesProibidas.includes(tipo)) {
    return res.status(403).json({ erro: 'Cadastro deste tipo de usuário deve ser feito via convite do Dono Master.' });
  }

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    const hash = bcrypt.hashSync(senha, 12);
    const userId = String(Date.now());
    const newUser = {
      id: userId,
      nome,
      email,
      hash,
      telefone: telefone || '',
      tipo: tipo || 'cliente',
      ativo: true,
      pontos: 0,
      nivel: 'Bronze'
    };

    await setDoc(doc(db, "users", userId), newUser);
    await registrarLog(userId, 'REGISTRO', `Novo usuário ${newUser.tipo} registrado`);

    const { hash: _, ...userPublic } = newUser;
    res.status(201).json({ token: gerarToken(userPublic), usuario: userPublic });
  } catch (error) {
    console.error("Player register error:", error);
    res.status(500).json({ erro: 'Erro interno ao realizar registro.' });
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return res.status(401).json({ erro: 'Credenciais inválidas ou conta inativa.' });

    const userDoc = snap.docs[0];
    const user = userDoc.data();
    if (!user.ativo) return res.status(401).json({ erro: 'Conta inativa.' });

    const ok = await bcrypt.compare(senha, user.hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas.' });

    await registrarLog(user.id, 'LOGIN', 'Login realizado com sucesso');

    const { hash: _, ...userPublic } = user;
    res.json({ token: gerarToken(userPublic), usuario: userPublic });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ erro: 'Erro interno no servidor' });
  }
});

authRouter.post('/convidar', autenticar, async (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Apenas Dono Master pode convidar.' });

  const { email, tipo, permissoes } = req.body;
  const token = Math.random().toString(36).substring(2, 15);

  try {
    const convite = {
      token,
      email,
      tipo,
      permissoes: permissoes || {},
      criado_em: new Date().toISOString()
    };

    await setDoc(doc(db, "invites", token), convite);
    await registrarLog(req.usuario.id, 'CONVITE_ENVIADO', `Convite enviado para ${email} como ${tipo}`);

    res.json({ token, msg: 'Convite gerado com sucesso. Envie o link ao usuário.' });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao gerar convite." });
  }
});

authRouter.post('/aceitar-convite', async (req, res) => {
  const { token, senha, nome, telefone } = req.body;
  try {
    const inviteRef = doc(db, "invites", token);
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) return res.status(400).json({ erro: 'Convite inválido ou expirado.' });

    const convite = snap.data();
    const hash = bcrypt.hashSync(senha, 12);
    const userId = String(Date.now());

    const newUser = {
      id: userId,
      nome,
      email: convite.email,
      hash,
      telefone: telefone || '',
      tipo: convite.tipo,
      permissoes: convite.permissoes,
      ativo: true,
      pontos: 0,
      nivel: 'Iniciante'
    };

    await setDoc(doc(db, "users", userId), newUser);
    await deleteDoc(inviteRef);

    await registrarLog(userId, 'CONVITE_ACEITO', `Usuário ${convite.email} aceitou o convite`);

    const { hash: _, ...userPublic } = newUser;
    res.json({ token: gerarToken(userPublic), usuario: userPublic });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao aceitar convite." });
  }
});

authRouter.get('/perfil', autenticar, (req: any, res) => {
  res.json(req.usuario);
});
app.use('/api/auth', authRouter);

// BACKOFFICE ADMIN GESTÃO
const adminGestaoRouter = express.Router();
adminGestaoRouter.use(autenticar);

adminGestaoRouter.get('/usuarios', async (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  try {
    const snap = await getDocs(collection(db, "users"));
    const list = snap.docs.map(d => {
      const { hash, ...u } = d.data();
      return u;
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar usuários." });
  }
});

adminGestaoRouter.get('/convites', async (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  try {
    const snap = await getDocs(collection(db, "invites"));
    res.json(snap.docs.map(d => d.data()));
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar convites." });
  }
});

adminGestaoRouter.patch('/usuarios/:id', async (req: any, res) => {
  if (req.usuario.tipo !== 'dono_master') return res.status(403).json({ erro: 'Acesso negado.' });
  try {
    const userId = String(req.params.id);
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    await updateDoc(userRef, req.body);
    await registrarLog(req.usuario.id, 'USUARIO_EDITADO', `Editado usuário ${snap.data().email}`);
    
    const updatedSnap = await getDoc(userRef);
    res.json(updatedSnap.data());
  } catch (error) {
    res.status(500).json({ erro: "Erro ao editar usuário." });
  }
});

adminGestaoRouter.get('/logs', async (req: any, res) => {
  if (!checkPermissao(req.usuario, 'logs', 'ver')) return res.status(403).json({ erro: 'Sem permissão.' });
  try {
    const snap = await getDocs(collection(db, "logs"));
    const logs = snap.docs.map(d => d.data());
    res.json(logs.sort((a: any, b: any) => b.id - a.id).slice(0, 50));
  } catch (error) {
    res.status(500).json({ erro: "Erro ao resgatar logs." });
  }
});

app.use('/api/admin_gestao', adminGestaoRouter);

// RESTAURANTES & PRODUTOS
const restRouter = express.Router();
restRouter.get('/', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, "restaurants"));
    res.json(snap.docs.map(d => d.data()));
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar restaurantes." });
  }
});

restRouter.get('/:id', async (req, res) => {
  const restId = String(req.params.id);
  try {
    const restRef = doc(db, "restaurants", restId);
    const snap = await getDoc(restRef);
    if (!snap.exists()) return res.status(404).json({ erro: "Restaurante não encontrado" });

    const prodSnap = await getDocs(collection(db, "restaurants", restId, "products"));
    const produtos = prodSnap.docs.map(p => p.data());

    res.json({ ...snap.data(), produtos });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar detalhes do restaurante." });
  }
});

restRouter.post('/:id/produtos', autenticar, permitir('restaurante', 'admin'), async (req: any, res) => {
  const restId = String(req.params.id);
  const { nome, descricao, preco, categoria } = req.body;
  try {
    const prodId = String(Date.now());
    const newProd = { id: prodId, restaurante_id: restId, nome, descricao, preco: Number(preco), categoria };
    await setDoc(doc(db, "restaurants", restId, "products", prodId), newProd);
    res.status(201).json(newProd);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao criar produto." });
  }
});

app.use('/api/restaurantes', restRouter);

// PEDIDOS
const pedidoRouter = express.Router();
pedidoRouter.post('/', autenticar, async (req: any, res) => {
  const { restaurante_id, itens, endereco, subtotal, taxa, total, forma_pagamento } = req.body;
  try {
    const restId = String(restaurante_id);
    const restRef = doc(db, "restaurants", restId);
    const restSnap = await getDoc(restRef);
    const rest = restSnap.exists() ? restSnap.data() : null;

    const orderId = `ORD-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const newPedido = {
      id: orderId,
      usuario_id: String(req.usuario.id),
      restaurante_id: restId,
      restaurante_nome: rest?.nome || "Estabelecimento",
      restaurante_logo: rest?.logo_url || "",
      itens,
      endereco,
      subtotal: Number(subtotal),
      taxa: Number(taxa),
      total: Number(total),
      forma_pagamento,
      status: 'recebido',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      pontos_ganhos: calcularPontos(total)
    };

    await setDoc(doc(db, "orders", orderId), newPedido);

    // Update loyalty points
    const userRef = doc(db, "users", String(req.usuario.id));
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const user = userSnap.data();
      const novosPontos = (user.pontos || 0) + newPedido.pontos_ganhos;
      let novoNivel = user.nivel || 'Bronze';
      if (novosPontos > 5000) novoNivel = 'Diamante';
      else if (novosPontos > 1500) novoNivel = 'Ouro';
      else if (novosPontos > 500) novoNivel = 'Prata';

      await updateDoc(userRef, { pontos: novosPontos, nivel: novoNivel });
    }

    res.status(201).json(newPedido);
  } catch (error) {
    console.error("Order save error:", error);
    res.status(500).json({ erro: "Erro ao realizar pedido." });
  }
});

pedidoRouter.get('/', autenticar, async (req: any, res) => {
  try {
    const snap = await getDocs(collection(db, "orders"));
    let ordersList = snap.docs.map(d => d.data());

    if (req.usuario.tipo === 'restaurante') {
      ordersList = ordersList.filter((p: any) => p.restaurante_id === "1"); 
    } else if (req.usuario.tipo !== 'admin') {
      ordersList = ordersList.filter((p: any) => p.usuario_id === String(req.usuario.id));
    }

    res.json(ordersList.sort((a: any, b: any) => b.criado_em.localeCompare(a.criado_em)));
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar pedidos." });
  }
});

pedidoRouter.patch('/:id/status', autenticar, async (req: any, res) => {
  try {
    const id = String(req.params.id);
    const orderRef = doc(db, "orders", id);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return res.status(404).json({ erro: "Pedido não encontrado" });

    const oldOrder = snap.data();
    if (oldOrder.status === 'entregue' || oldOrder.status === 'cancelado') {
      return res.status(400).json({ erro: "Não é possível alterar o status de um pedido finalizado." });
    }

    await updateDoc(orderRef, {
      status: req.body.status,
      atualizado_em: new Date().toISOString()
    });

    const updatedSnap = await getDoc(orderRef);
    res.json(updatedSnap.data());
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar status do pedido." });
  }
});

app.use('/api/pedidos', pedidoRouter);

// DASHBOARD / STATS
app.get('/api/admin/stats', autenticar, permitir('admin', 'restaurante'), async (req: any, res) => {
  try {
    const orderSnap = await getDocs(collection(db, "orders"));
    const orders = orderSnap.docs.map(d => d.data());

    const totalFaturamento = orders.reduce((acc: number, p: any) => acc + p.total, 0);
    const totalPedidos = orders.length;

    const userSnap = await getDocs(collection(db, "users"));
    const totalUsuarios = userSnap.docs.length;

    res.json({
      faturamento: totalFaturamento,
      pedidos: totalPedidos,
      usuarios: totalUsuarios,
      recentOrders: orders.slice(-5).reverse()
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao carregar faturamento." });
  }
});

// ENDEREÇOS
app.post('/api/enderecos', autenticar, async (req: any, res) => {
  const userId = String(req.usuario.id);
  const addrId = String(Date.now());
  try {
    const addrRef = collection(db, "users", userId, "addresses");
    const snap = await getDocs(addrRef);
    const count = snap.size;

    const newEnd = {
      id: addrId,
      usuario_id: userId,
      ...req.body,
      principal: count === 0
    };

    await setDoc(doc(db, "users", userId, "addresses", addrId), newEnd);
    res.status(201).json(newEnd);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao registrar endereço." });
  }
});

app.get('/api/enderecos', autenticar, async (req: any, res) => {
  const userId = String(req.usuario.id);
  try {
    const snap = await getDocs(collection(db, "users", userId, "addresses"));
    res.json(snap.docs.map(d => d.data()));
  } catch (error) {
    res.status(500).json({ erro: "Erro ao listar endereços" });
  }
});

app.patch('/api/enderecos/:id/principal', autenticar, async (req: any, res) => {
  const userId = String(req.usuario.id);
  const idStr = String(req.params.id);
  try {
    const refCol = collection(db, "users", userId, "addresses");
    const snap = await getDocs(refCol);
    for (const d of snap.docs) {
      await updateDoc(doc(db, "users", userId, "addresses", d.id), {
        principal: d.id === idStr
      });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao definir principal." });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, "users"));
    res.json({ status: 'ok', size: snap.size, env: process.env.NODE_ENV });
  } catch (error) {
    res.json({ status: 'ok', size: 0, env: process.env.NODE_ENV, error: String(error) });
  }
});

// Chatbot secure Gemini endpoint
app.post('/api/chatbot', async (req: any, res: any) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ erro: 'Mensagem é obrigatória.' });

  const ai = getGeminiClient();
  if (!ai) {
    const queryStr = message.toLowerCase();
    let reply = "";
    if (queryStr.includes('motoboy') || queryStr.includes('entregador') || queryStr.includes('separado') || queryStr.includes('app') || queryStr.includes('aplicativo') || queryStr.includes('baixar')) {
      reply = "Sim, mestre! Quando o GrajaFood estiver oficialmente no ar, haverá um aplicativo separado e dedicado para os entregadores (chamado 'GrajaFood Entregas'). De forma alguma os motoboys usarão o mesmo app dos clientes: eles terão uma plataforma limpa e leve só para aceitar corridas, ver mapas de navegação locais no Grajaú e gerenciar seus ganhos do dia de forma 100% autônoma!";
    } else if (queryStr.includes('taxa') || queryStr.includes('entrega') || queryStr.includes('percurso') || queryStr.includes('valor') || queryStr.includes('preço')) {
      reply = "A cobrança de taxa de entrega do GrajaFood funciona com total clareza e integridade:\n- Até 1,5 km de distância: taxa fixa de R$ 6,50 mestre.\n- Acima de 1,5 km: adiciona-se R$ 2,00 por km rodado até o limite máximo de alcance de 11 km do estabelecimento.";
    } else if (queryStr.includes('restaurante') || queryStr.includes('parceiro') || queryStr.includes('comida') || queryStr.includes('burger') || queryStr.includes('pizza') || queryStr.includes('graja burger') || queryStr.includes('pizzaria')) {
      reply = "Atualmente as estrelas do Grajaú conosco são:\n1. Graja Burger: Conhecido pelo lendário X-Graja (R$ 25,90) e Batata do Fundão!\n2. Pizzaria São José: Tradição absoluta servindo pizzas artesanais de calabresa incríveis!\n\nQuer que eu ajude a escolher algum mestre?";
    } else {
      reply = `Salve! Sou o Assistente de Inteligência Artificial do GrajaFood, 100% íntegro e focado em nossa comunidade no Grajaú.\n\nPergunte-me qualquer dúvida sobre:\n- O aplicativo separado dos motoboys ('GrajaFood Entregas')\n- Taxas de entrega e distâncias suportadas\n- Nossos restaurantes parceiros e cardápios e segundas vias!`;
    }
    return res.json({ text: reply + "\n\n*(Nota: O chatbot está rodando em modo de simulação integrada de alta fidelidade porque nenhuma chave GEMINI_API_KEY foi definida nas variáveis de ambiente)*" });
  }

  try {
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.slice(-10).forEach((h: any) => {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.message }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: `Você é o "Agente de IA GrajaFood", um assistente de inteligência artificial 100% íntegro, amigável, sincero e transparente focado em tirar dúvidas da comunidade do GrajaFood (restaurantes parceiros, clientes e entregadores do Grajaú, Zona Sul de São Paulo).

REGRAS DE CONDUTA E INTEGRIDADE:
1. Respostas Honestidades e Seguras: Seja 100% sincero e íntegro. Nunca finja saber o status em tempo real de pedidos ativos além do que consta nas informações do sistema. Se houver dúvidas fora do seu escopo, fale com educação para contatar o suporte humano do GrajaFood.
2. Uso da linguagem: Fale de maneira prestativa, combinando termos descontraídos do Grajaú ("mestre", "fundão", "quebrada", "firmeza") com precisão e clareza total.
3. Se o usuário perguntar sobre o aplicativo para motoboys / entregador:
   - CONFIRME COM PRECISÃO ABSOLUTA: Sim! Quando o GrajaFood estiver oficialmente publicado ("no ar"), haverá um aplicativo totalmente separado e exclusivo para os entregadores (chamado "GrajaFood Entregas"). Os motoboys terão um aplicativo separado do aplicativo dos clientes para maior performance, melhor carregamento de rotas e rastreamento de ganhos diários.
4. Explique as tabelas de taxas com total integridade: R$ 6,50 de taxa fixa até 1.5 km do restaurante parceiro. Fora isso, acréscimos de R$ 2,00 por km adicional, até um raio máximo de 11 km.
5. Seja direto, caloroso e use Markdown elegante para estruturar as respostas.`,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Erro na integração Gemini:", err);
    res.status(500).json({ erro: "Erro de processamento da inteligência artificial: " + (err.message || err) });
  }
});

// ── Vite Integration ─────────────────────────────────────────

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import('vite');
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
      console.log(`GrajaFood API rodando na porta ${PORT} em modo ${process.env.NODE_ENV || 'development'}`);
    });

    // Run seeding asynchronously in the background. If database has connection delays, 
    // the TCP port check/startup probe still immediately succeeds.
    preseedFirestore().catch(err => {
      console.error("Erro assíncrono no pré-semeamento do Firestore:", err);
    });
  } catch (err) {
    console.error("FALHA CRÍTICA NO SERVIDOR:", err);
    process.exit(1);
  }
}

startServer();
