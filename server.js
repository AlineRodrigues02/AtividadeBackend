// importções padrões 
const express = require('express'); //importação padrão que sempre deve está numa APi
const { PrismaClient } = require('@prisma/client'); //Importando para a conexão o prisma

const app = express();
const PORT = 3000;
app.use(express.json());

const prisma = new PrismaClient(); //Instancia unica do Prima 

//Vamos fazer os métodos principais 
//Get usuarios
app.get("/usuarios", async (req, res) => {
    try {
        const usuarios = await prisma.usuario.findMany({ include: { pedidos: true } });
        res.json(usuarios);

    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar o usuario" })
    }
});
//get /usuarios/:id
app.get("/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: parseInt(id) },
            include: { pedidos: true }
        })

        if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });
        res.json(usuario);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

app.post("/usuarios", async (req, res) => {
    const { nome, email } = req.body;
    try {
        const novoUsuario = await prisma.usuario.create({
            data: { nome, email }
        })
        res.status(201).json(novoUsuario);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// Post para criar produtos
app.post("/produtos", async (req, res) => {
    const { nome, preco, estoque } = req.body;
    try {
        const novoProduto = await prisma.produto.create({
            data: { nome, preco, estoque }
        })
        res.status(201).json(novoProduto);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
//Get de /produtos 
app.get("/produtos", async (req, res) => {
    try {
        const produtos = await prisma.produto.findMany({ orderBy: { nome: "asc" } });
        res.json(produtos);
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao buscar o produto" })
    }
});

//Post para criar pedidos 
// Post /pedidos
app.post("/pedidos", async (req, res) => {
    const { usuarioId, itens } = req.body;
    try {
        const usuario = await prisma.usuario.findUnique({
            where: { id: usuarioId }
        });
        if (!usuario) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        // Cria o pedido
        const novoPedido = await prisma.pedido.create({
            data: {
                usuarioId, itens: {
                    create: await Promise.all(itens.map(async (item) => {
                        // busca o produto
                        const produto = await prisma.produto.findUnique({
                            where: { id: item.produtoId }
                        });

                        if (!produto) {
                            throw new Error(`Produto ${item.produtoId} não encontrado`);
                        }
                        if (produto.estoque < item.quantidade) {
                            throw new Error(`Estoque insuficiente para o produto ${produto.nome}`);
                        }

                        // retorna o objeto que será criado em ItemPedido
                        return {
                            produtoId: item.produtoId,
                            quantidade: item.quantidade,
                            precoUnitario: produto.preco
                        };
                    })
                    )
                }
            },
            include: {
                itens: true,
            }
        });
        res.status(201).json(novoPedido);

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

//Get /pedidos 
app.get("/pedidos", async (req, res) => {
    try {
        const pedidos = await prisma.pedido.findMany({
            include: {
                usuario: true,  // inclui dados do usuário
                itens: {
                    include: {
                        produto: true  // inclui dados do produto de cada item
                    }
                }
            },
            orderBy: { data: 'desc' } // opcional: ordena pelo mais recente
        });
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//atualização de /pedidos/{id} 
app.put("/pedidos/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // pode receber status ou outros campos que você queira permitir

    try {
        const pedidoAtualizado = await prisma.pedido.update({
            where: { id: parseInt(id) },
            data: { status }
        });
        res.json(pedidoAtualizado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});




app.put("/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, email } = req.body;
    try {
        const id = parseInt(req.params.id);

        const usuarioAtualizado = await prisma.usuario.update({
            where: { id },
            data: { nome, email }
        });
        res.json(usuarioAtualizado);
    }
    catch (error) {
        // if(e.code ==='P2025') return res.status(404).json({error: "Usuário não encontrado"});
        res.status(400).json({ error: "Erro ao atualizar usuário" })
    }
})

app.delete("/usuarios/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        await prisma.usuario.delete({ where: { id } });
        res.send("Usuário deletado com sucesso!");
    } catch (e) {
        if (e.code === 'p2025') return res.status(404).send("Usuário não encontrado");
        res.status(500).json({ error: "Erro ao deletar usuário" })

    }
})
//Aqui será a construção de outros get que foram pedidos na atividade

//Get/produtos/busca
app.get("/produtos/busca", async (req, res) => {
    const { q, minPreco, maxPreco, onlyDisponiveis } = req.query;

    const produtos = await prisma.produto.findMany({
        where: {
            nome: q ? { contains:q, mode: "insensitive" } : undefined,
            preco: {
                gte: minPreco ? Number(minPreco) : undefined,
                lte: maxPreco ? Number(maxPreco) : undefined
            },
            ativo: onlyDisponiveis === "true" ? true : undefined
        }
    })

    res.json(produtos);
});

//GET /produtos/baixo-estoque

app.get("/produtos/baixo-estoque", async (req, res) => {
    const threshold = Number(req.query.threshold) || 5;

    const produtos = await prisma.produto.findMany({
        where: { estoque: { lte: threshold }, ativo: true }
    });
    res.json(produtos)
})

//GET /pedidos/{id}/total

app.get("/pedidos/:id/total", async (req, res) => {
    const { id } = req.params;

    const itens = await prisma.itemPedido.findMany({
        where: { pedidoId: parseInt(id) }
    });
    const total = itens.reduce((acc, item) => acc + Number(item.precoUnitario) * item.quantidade, 0);

    res.json({ pedidoId: id, total });

})
//GET /usuarios/{id}/recompra
app.get("/usuarios/:id/recompra", async (req, res) => {
    // const {id} = req.params;
    const id = parseInt(req.params.id);
    const { de, ate } = req.query;

    const pedidos = await prisma.pedido.findMany({
        where: {
            usuarioId: id,
            data: {
                gte: de ? new Date(de) : undefined,
                lte: ate ? new Date(ate) : undefined
            }
        }
    })

    const totalPedidos = pedidos.length;
    const pedidosRecompra = pedidos.length > 1 ? pedidos.length : 0;

    taxa = totalPedidos ? pedidosRecompra / totalPedidos : 0;

    res.json({ usuarioId: id, taxaRecompra: taxa })

})


//GET /relatorios/faturamento-diario
app.get("/relatorios/faturamento-diario", async (req, res) => {
    const { de, ate } = req.query;

    const itens = await prisma.itemPedido.findMany({
        where: {
            pedido: {
                data: {
                    gte: de ? new Date(de) : undefined,
                    lte: ate ? new Date(ate) : undefined
                }
            }
        },
        include: { pedido: true }
    });
    const faturamentoPorDia = {};
    itens.forEach(item => {
        const dia = item.pedido.data.toISOString().slice(0, 10);
        faturamentoPorDia[dia] = (faturamentoPorDia[dia] || 0)
    });
    res.json(faturamentoPorDia);
});


// GET /relatorios/cesta-media
app.get("/relatorios/cesta-media", async (req, res) => {
    const { de, ate } = req.query;

    const itens = await prisma.itemPedido.findMany({
        where: {
            pedido: {
                data: {
                    gte: de ? new Date(de) : undefined,
                    lte: ate ? new Date(ate) : undefined
                }
            }

        },
        include: { pedido: true }
    });
    const pedidosMap = {};
    itens.forEach(item => {
        const pedidoId = item.pedidoId;
        if (!pedidosMap[pedidoId]) pedidosMap[pedidoId] = [];
        pedidosMap[pedidoId].push(item);
    });
    const totalPedidos = Object.keys(pedidosMap).length;
    const totalItens = itens.length;
    const totalValor = itens.reduce((acc, item) => acc + Number(item.precoUnitario) * item.quantidade, 0);
    res.json({
        ticketMedio: totalValor / totalPedidos || 0,
        itensMedio: totalItens / totalPedidos || 0
    });
});


// GET /produtos/{id}/historico-precos
app.get("/produtos/:id/historico-precos", async (req, res) => {
    const id = parseInt(req.params.id);
    const { de, ate } = req.query;

    const itens = await prisma.itemPedido.findMany({
        where: {
            produtoId: id,
            pedido: {
                data: {
                    gte: de ? new Date(de) : undefined,
                    lte: ate ? new Date(ate) : undefined
                }
            }
        },
        select: { precoUnitario: true, pedido: { select: { data: true } } }
    });
    res.json(itens)
})

//GET /pedidos/abertos?usuarioId=


app.get("/pedidos/abertos", async (req, res) => {
    const { usuarioId } = req.query;

    const pedidos = await prisma.pedido.findMany({
        where: {
            usuarioId: parseInt(usuarioId),
            status: "ABERTO"
        },
        include: { itens: true }
    })
    res.json(pedidos)
})


// chamando a porta para iniciar o servidor 

app.listen(PORT, () => {
    console.log(`O servidor está rodando em: http://localhost:${PORT}`)
})