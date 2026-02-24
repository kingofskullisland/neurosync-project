/**
 * NeuroSync FAQ Data
 */

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category: 'general' | 'connection' | 'models' | 'routing' | 'chats' | 'troubleshooting';
}

export const FAQ_DATA: FAQItem[] = [
    // General
    {
        id: 'what-is-neurosync',
        question: 'What is NeuroSync?',
        answer:
            'NeuroSync is a 3-tier AI assistant that intelligently routes your queries between your phone (local), your PC (via Tailscale VPN), and cloud services. It balances speed, power, and battery life automatically.',
        category: 'general',
    },
    {
        id: 'how-tiers-work',
        question: 'How do the 3 tiers work?',
        answer:
            'Tier 1 (LOCAL): Runs small AI models directly on your device for fast, simple responses.\n\nTier 2 (PC): Routes complex queries to your PC via Tailscale VPN, where larger models like Llama can run with full GPU power.\n\nTier 3 (CLOUD): Falls back to cloud AI services when local and PC are unavailable.',
        category: 'general',
    },
    {
        id: 'akira-theme',
        question: 'Why the Akira theme?',
        answer:
            'The interface is inspired by the 1988 anime film Akira — specifically the military HUD displays, SOL satellite controls, and Neo-Tokyo aesthetic. It combines functional clarity with cyberpunk atmosphere.',
        category: 'general',
    },

    // Connection
    {
        id: 'what-is-tailscale',
        question: 'What is Tailscale?',
        answer:
            'Tailscale is a zero-config VPN that creates a secure mesh network between your devices. Install it on both your phone and PC to get a stable IP address (usually starting with 100.x.x.x) that works from anywhere.',
        category: 'connection',
    },
    {
        id: 'how-to-connect',
        question: 'How do I connect to my PC?',
        answer:
            '1. Install Tailscale on your phone and PC\n2. Sign in with the same account on both\n3. Find your PC\'s Tailscale IP (run "tailscale ip" on PC)\n4. Enter it in Settings → Connection → VPN/Tailscale IP\n5. Make sure the NeuroSync bridge is running on your PC (port 8082)\n6. Hit "Test Connection" to verify',
        category: 'connection',
    },
    {
        id: 'bridge-offline',
        question: 'Why does it say "Bridge Offline"?',
        answer:
            'The bridge is the Python server running on your PC that connects NeuroSync to Ollama. Make sure:\n\n• The bridge script is running (python mobile_bridge.py)\n• Ollama is installed and running on your PC\n• Your Tailscale VPN is connected\n• The IP address in settings is correct',
        category: 'connection',
    },

    // Models
    {
        id: 'what-are-models',
        question: 'What are AI models?',
        answer:
            'AI models are the "brains" that generate responses. Different models have different capabilities:\n\n• llama3.2 — Fast, good for general chat\n• codellama — Specialized for code\n• mistral — Balanced performance\n\nYou can switch models in Settings → AI Model.',
        category: 'models',
    },
    {
        id: 'how-to-switch-model',
        question: 'How do I switch models?',
        answer:
            'Go to Settings → AI Model. If connected to your PC, available models will be listed automatically. Tap any model to select it. You can also type a model name manually.\n\nNote: The model must be installed on your Ollama server. Use "ollama pull <model>" on your PC to install new ones.',
        category: 'models',
    },
    {
        id: 'model-monitoring',
        question: 'What does model monitoring show?',
        answer:
            'Model monitoring tracks:\n• Response time — How fast the model generates answers\n• Request count — How many queries processed\n• Error count — Failed requests\n• Status — Whether the model is loaded in memory\n\nThis helps you identify if a model is struggling and switch to a better one.',
        category: 'models',
    },

    // Routing
    {
        id: 'route-modes',
        question: 'What are the route modes?',
        answer:
            'AUTO: NeuroSync decides the best tier based on battery, query complexity, and availability.\n\nLOCAL: Forces all queries to run on-device (may be slower for complex tasks).\n\nPC: Routes everything to your PC (needs active VPN connection).\n\nCLOUD: Uses cloud services only.',
        category: 'routing',
    },
    {
        id: 'battery-threshold',
        question: 'What is the battery threshold?',
        answer:
            'In AUTO mode, when your battery drops below this percentage, NeuroSync stops using local processing (which drains battery) and routes queries to your PC or cloud instead. Default is 20%.',
        category: 'routing',
    },
    {
        id: 'char-threshold',
        question: 'What is the character limit threshold?',
        answer:
            'In AUTO mode, queries longer than this character count are considered "complex" and get routed to your PC for better processing. Short queries stay local. Default is 100 characters.',
        category: 'routing',
    },

    // Chats
    {
        id: 'save-chats',
        question: 'How are chats saved?',
        answer:
            'Chats are saved automatically to your device. You can view past conversations in the Chat History screen. Each chat shows the first message as a title, the date, and message count.',
        category: 'chats',
    },
    {
        id: 'export-chats',
        question: 'How do I export chats to my PC?',
        answer:
            'Open Chat History, select a conversation, and tap the Export button. This sends the chat data to your PC via the bridge, where it\'s stored in the AI-Workspace drive for further processing.',
        category: 'chats',
    },
    {
        id: 'settings-while-chatting',
        question: 'Why can\'t I change settings during a chat?',
        answer:
            'Changing settings (especially the AI model or connection) while a chat is active could cause errors or lost messages. Save or close your current chat first, then modify settings.',
        category: 'chats',
    },

    // Troubleshooting
    {
        id: 'empty-responses',
        question: 'Why am I getting empty responses?',
        answer:
            'This usually means:\n• The selected model isn\'t installed on Ollama (run "ollama pull <model>" on PC)\n• The model name is misspelled in settings\n• Ollama is running but the model failed to load (check PC logs)\n\nTry switching to a different model or restarting Ollama.',
        category: 'troubleshooting',
    },
    {
        id: 'timeout-errors',
        question: 'Why do I get timeout errors?',
        answer:
            'Large models can take 30+ seconds to respond, especially on first use (loading into RAM). If timeouts persist:\n\n• Try a smaller model (e.g., llama3.2:latest)\n• Check your VPN connection speed\n• Make sure your PC isn\'t under heavy load',
        category: 'troubleshooting',
    },
    {
        id: 'app-crash',
        question: 'The app seems stuck or unresponsive',
        answer:
            'If a model gets stuck:\n1. Switch to a different model in Settings\n2. Clear the current chat\n3. Restart the bridge on your PC\n4. If the issue persists, force-close the app and reopen\n\nModel monitoring can help detect when a model is struggling before it causes issues.',
        category: 'troubleshooting',
    },
];

export const FAQ_CATEGORIES = [
    { key: 'general' as const, label: 'General', icon: '📋' },
    { key: 'connection' as const, label: 'Connection', icon: '🔗' },
    { key: 'models' as const, label: 'AI Models', icon: '🧠' },
    { key: 'routing' as const, label: 'Routing', icon: '🔀' },
    { key: 'chats' as const, label: 'Chat Management', icon: '💬' },
    { key: 'troubleshooting' as const, label: 'Troubleshooting', icon: '🔧' },
];
