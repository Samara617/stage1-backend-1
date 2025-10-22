const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? [] : ['query', 'info', 'warn', 'error']
});

module.exports = { prisma };