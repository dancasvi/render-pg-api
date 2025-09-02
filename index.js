import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Faltou configurar DATABASE_URL no .env');
  process.exit(1);
}

// Pool com SSL habilitado (Render exige TLS)
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true } // pode usar { ssl: true } também
});

// Consulta fornecida por você
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

// Healthcheck simples
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Endpoint principal
app.get('/produtos', async (req, res) => {
  try {
    const { rows } = await pool.query(QUERY);
    // rows traz "anexos" como array de texto do Postgres
    res.json(rows);
  } catch (e) {
    console.error('Erro ao consultar /produtos:', e);
    res.status(500).json({ error: 'Falha ao consultar produtos', detail: e.message });
  }
});

// Inicialização
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port}`);
});