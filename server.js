import express from 'express'
import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import logger from 'morgan'

const prisma = new PrismaClient()
const app = express()
app.use(express.json())
app.use(cors())
app.use(logger('dev'))
//Segredo para assinar os tokens JWT
const JWT_SECRET = 'minha-chave-secreta';

app.post('/login', async (req, res) => {
    const{ email, password } = req.body;

    // Verifica se o usuário existe no banco de dados
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
    }

    // Compara a senha fornecida com a senha armazenada (usando bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Senha incorreta' });
    }

    // Gera o token JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    
    res.status(201).json({ message: 'Usuarios criado com sucesso', user, token})
});

app.post('/register', async (req, res) => {
    const { name, email, password} = req.body;
    try {
        // Verifica se já existe um usuário com o mesmo email
        const existingUser = await prisma.user.findUnique({
            where: {email:email},
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email já está em uso' });
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Cria o usuário no banco de dados
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        res.status(201).json({ message: 'Usuário registrado com sucesso', user: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

app.get('/usuarios', async (req, res) => {
    let users;

    if (req.query.name || req.query.email || req.query.contact) {
        users = await prisma.user.findMany({
            where: {
                    name: req.query.name,
                    email: req.query.email,
                    contact: req.query.contact
            },
        });
        } else {
        users = await prisma.user.findMany()
    }

    res.status(200).json(users)

});

    app.put('/usuarios/:id', async (req, res) => {

        await prisma.user.update({
        where: {
            id: Number(req.params.id),
        },
        data: {
            name: req.body.name,
            email: req.body.email,
            contact: req.body.contact,
        }
    })

    res.status(201).json(req.body)

})

app.delete('/usuarios/:id', async (req, res) => {
    try{
        const id = req.params.id;
        await prisma.user.delete({
            where: {
                id: Number(id),
            },
        })
    
        res.status(200).json({ message: 'Usuario deletado com sucesso!'})
    }catch(err){
        console.log(err)
        res.status(500).json({ message: 'Erro ao deletar o usuário'})
    }
})

// Middleware de validação de token JWT
const validarToken = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
        return res.status(403).json({ message: 'Token não fornecido' });
    }

    try {
        // Verifica e decodifica o token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded; // Passa as informações do usuário para o próximo middleware
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido' });
    }
};

// Exemplo de rota protegida
app.get('/usuarios/protegidos', validarToken, async (req, res) => {
    const usuarios = await prisma.user.findMany();
    res.status(200).json({ usuarios, usuarioAutenticado: req.usuario });
});

app.listen(3000, ()=>{
    console.log("Servidor rodando na porta http://localhost:3000")
})

//DAQUI PRA CIMA É FUNÇÕES PARA O USÚARIO
//DAQUI PRA CIMA É FUNÇÕES PARA O USÚARIO
//DAQUI PRA CIMA É FUNÇÕES PARA O USÚARIO

//Criar um novo contato
app.post('/contatos', validarToken, async (req, res) => {
    const { name, lastName, email, phone } = req.body;
    const userId = req.usuario.id;
  
    try {
      const newContact = await prisma.contact.create({
        data: {
          name,
          lastName,
          email,
          phone,
          userId,
        },
      });
      res.status(201).json({ message: 'Contato criado com sucesso', contact: newContact });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro ao criar o contato' });
    }
  });

//Listar todos os contatos de um usuário
app.get('/contatos', validarToken, async (req, res) => {
  const userId = req.usuario.id;
  const { nome, sobrenome, busca } = req.query;  // A busca agora pode ser feita por 'nome', 'sobrenome' ou 'busca'
  
  try {
      const contacts = await prisma.contact.findMany({
          where: {
              userId,
              AND: [
                  nome ? { name: { contains: nome, mode: 'insensitive' } } : {},
                  sobrenome ? { lastName: { contains: sobrenome, mode: 'insensitive' } } : {},
                  busca ? {
                      OR: [
                          { name: { contains: busca, mode: 'insensitive' } },
                          { lastName: { contains: busca, mode: 'insensitive' } },
                          { email: { contains: busca, mode: 'insensitive' } },
                          { phone: { contains: busca, mode: 'insensitive' } },
                      ],
                  } : {},
              ],
          },
      });
      res.status(200).json(contacts);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro ao listar os contatos' });
  }
});


// Rota para listar os contatos favoritos
app.get('/contatos/favoritos', async (req, res) => {
  //console.log(req.headers); // Verifique os cabeçalhos
  //console.log(req.query); // Verifique os parâmetros de consulta, se houver

  try {
      const contatosFavoritos = await prisma.contact.findMany({
          where: {
              isFavorite: true, // Filtra contatos onde 'isFavorite' é true
          },
      });
      res.json(contatosFavoritos);
  } catch (error) {
      console.error('Erro ao buscar contatos favoritos:', error);
      res.status(500).json({ message: 'Erro ao buscar contatos favoritos' });
  }
});

  //Marcar/desmarcar um contato como favorito
  app.put('/contatos/:id/favoritar', validarToken, async (req, res) => {
    const contactId = req.params.id;
    const userId = req.usuario.id;
  
    try {
      // Verifica se o contato pertence ao usuário
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });
  
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: 'Contato não encontrado ou não pertence ao usuário' });
      }
  
      // Atualiza o status de favorito
      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          isFavorite: !contact.isFavorite,  // Alterna entre true e false
        },
      });
  
      res.status(200).json({ message: 'Status de favorito alterado', contact: updatedContact });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro ao atualizar o favorito do contato' });
    }
  });
  //Deletar um contato
  app.delete('/contatos/:id', validarToken, async (req, res) => {
    const contactId = req.params.id;
    const userId = req.usuario.id;
  
    try {
      // Verifica se o contato pertence ao usuário
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });
  
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: 'Contato não encontrado ou não pertence ao usuário' });
      }
  
      // Deleta o contato
      await prisma.contact.delete({
        where: { id: contactId },
      });
  
      res.status(200).json({ message: 'Contato deletado com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro ao deletar o contato' });
    }
  });

  app.put('/contatos/:id', validarToken, async (req, res) => {
    const contactId = (req.params.id);
    const userId = req.usuario.id;
    const { name, lastName, email, phone } = req.body;
  
    try {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });
  
      if (!contact || contact.userId !== userId) {
        return res.status(404).json({ message: 'Contato não encontrado ou não pertence ao usuário' });
      }
  
      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: { name, lastName, email, phone },
      });
  
      res.status(200).json({ message: 'Contato atualizado com sucesso', contact: updatedContact });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Erro ao atualizar o contato' });
    }
  });
  

//PARA RODAR O SERVIDOR PRECISA DA CD Back-API NO TERMINAL E DEPOIS DAR UM node --watch server.js
  
//  user: davipadilha
//  senha do banco de dados: lG3M27LxIrQ5U3zw
