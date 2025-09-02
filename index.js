// index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const cn = process.env.DATABASE_URL;
if (!cn) {
  console.error('Faltou DATABASE_URL');
  process.exit(1);
}

// Detecta se é Internal URL (Render coloca ".internal." no host)
const isInternal = /\.internal\./i.test(cn);

// Pool configurado para Internal (sem SSL)
const pool = new Pool({
  connectionString: cn,
  ssl: isInternal ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.PGPOOL_MAX || '5', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true
});

// Log de erros no pool
pool.on('error', (err) => {
  console.error('Pool error:', err);
});

// Teste inicial de conexão
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Conectado ao Postgres com sucesso.');
  } catch (e) {
    console.error('Falha no SELECT 1:', e);
  }
})();

// Consulta principal
const QUERY = `
SELECT
  p.idproduto,
  p.nome        AS produto_nome,
  p.descricao,
  p.preco,
  p.quantidade,
  c.idcategoria,
  c.nome        AS categoria_nome,
  COALESCE(
    array_remove(array_agg(a.link ORDER BY a.idanexo), NULL),
    ARRAY[]::text[]
  )             AS anexos
FROM produto p
JOIN categoria c ON c.idcategoria = p.idcategoria
LEFT JOIN anexo a ON a.idproduto = p.idproduto
GROUP BY
  p.idproduto, p.nome, p.descricao, p.preco, p.quantidade,
  c.idcategoria, c.nome
ORDER BY p.idproduto;
`;

// Healthcheck
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint de produtos
app.get('/produtos', async (_req, res) => {
  try {
    const { rows } = await pool.query(QUERY);
    res.json(rows);
  } catch (e) {
    console.error('Erro ao consultar /produtos:', e);
    res.status(500).json({ error: 'Falha ao consultar produtos', detail: e.message });
  }
});

// Inicializa servidor
const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`API ouvindo em http://localhost:${port}`);
});
