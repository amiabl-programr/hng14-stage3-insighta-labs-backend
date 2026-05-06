import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yamljs';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerPath = path.resolve(__dirname, '../docs/swagger.yaml');
const swaggerDocument = YAML.load(swaggerPath);

export const setupSwagger = (app: Express): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Profile Management API Docs',
  }));
};
