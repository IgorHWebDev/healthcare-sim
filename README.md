# MedSimMentor Telegram Bot

A Telegram bot for medical simulation training and mentoring, powered by Google Vertex AI for dynamic scenario generation.

## Features

- Dynamic medical case generation using Google Vertex AI
- Real-time feedback on medical decisions
- Progress tracking and performance analytics
- Multiple difficulty levels for different experience levels
- Support for emergency medicine scenarios

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token
NODE_ENV=development

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your_project_id
VERTEX_LOCATION=us-central1

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

3. Set up Google Cloud Authentication:
   - Install Google Cloud SDK
   - Run `gcloud auth application-default login`
   - Ensure you have the necessary IAM roles:
     - `roles/aiplatform.user`
     - `roles/viewer`

4. Build the TypeScript code:
```bash
npm run build
```

## Running the Bot

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Available Commands

- `/start` - Start the bot and set your experience level
- `/help` - Show help message
- `/progress` - Check your progress and performance stats
- `/practice` - Start a practice session with a new medical case
- `/feedback` - Get detailed feedback on your last case
- `/settings` - Adjust your preferences and difficulty level

## Development

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and recompile
- `npm run dev` - Run the bot in development mode with hot-reload
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Architecture

The bot uses:
- Telegraf.js for Telegram bot functionality
- Google Vertex AI for medical case generation
- PostgreSQL for data persistence
- TypeScript for type safety
- Node.js runtime

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.