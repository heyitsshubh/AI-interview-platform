FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json .
RUN npm install --production

# Copy source code
COPY . .

# Health check (check if process is running)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD pgrep -f "node index.js" || exit 1

# Start worker
CMD ["node", "index.js"]
