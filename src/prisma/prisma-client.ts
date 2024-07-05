import { PrismaClient } from '@prisma/client';
import { pagination } from 'prisma-extension-pagination';

const DEFAULT_PAGE_LIMIT = 15;

const prismaWithPagination = new PrismaClient().$extends(
  pagination({
    pages: {
      includePageCount: true,
      limit: DEFAULT_PAGE_LIMIT,
    },
  }),
);

export default prismaWithPagination;
