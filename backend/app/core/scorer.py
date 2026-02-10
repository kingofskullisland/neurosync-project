"""
NeuroSync Router - Complexity Scorer
Analyzes queries to determine routing tier
"""
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class ComplexityScore:
    """Result of complexity analysis"""
    score: float
    factors: dict[str, float]
    recommendation: str  # 'local' | 'gemini' | 'claude' | 'ollama'
    reasoning: str  # Human-readable explanation of the decision



class ComplexityScorer:
    """
    Scores query complexity to determine routing.
    
    Factors:
    - Token count (0.3 weight)
    - Code keywords (0.25 weight)
    - Research markers (0.2 weight)
    - Multimodal content (0.15 weight)
    - Context length (0.1 weight)
    """
    
    WEIGHTS = {
        'token_count': 0.30,
        'code_keywords': 0.25,
        'research_markers': 0.20,
        'multimodal': 0.15,
        'context_length': 0.10,
    }
    
    # Code-related keywords
    CODE_KEYWORDS = {
        'function', 'class', 'def ', 'import ', 'async ', 'await ',
        'const ', 'let ', 'var ', 'return ', 'interface ', 'type ',
        'struct ', 'enum ', 'impl ', 'pub ', 'fn ', '::',
        'SELECT ', 'INSERT ', 'UPDATE ', 'CREATE ', 'ALTER ',
        'docker', 'kubernetes', 'k8s', 'terraform',
        'git ', 'commit', 'merge', 'rebase',
        'debug', 'error', 'exception', 'traceback',
        'refactor', 'optimize', 'benchmark',
    }
    
    # Research/analysis markers
    RESEARCH_MARKERS = {
        'explain', 'analyze', 'compare', 'contrast', 'evaluate',
        'research', 'investigate', 'summarize', 'synthesize',
        'what is', 'how does', 'why does', 'when should',
        'pros and cons', 'trade-offs', 'tradeoffs',
        'history of', 'evolution of', 'future of',
        'best practices', 'architecture', 'design pattern',
    }
    
    # Claude-preferred tasks
    CLAUDE_MARKERS = {
        'write code', 'implement', 'create a function',
        'build a', 'develop a', 'full implementation',
        'complete solution', 'production code',
        'unit test', 'integration test',
        'api design', 'system design',
        'code review', 'security audit',
    }
    
    def __init__(self, threshold: float = 0.4):
        self.threshold = threshold
    
    def score(
        self,
        query: str,
        has_image: bool = False,
        has_screen: bool = False,
        context_tokens: int = 0,
    ) -> ComplexityScore:
        """Calculate complexity score for a query"""
        
        factors = {}
        query_lower = query.lower()
        tokens = query.split()
        token_count = len(tokens)
        
        # Token count factor (normalized to 0-1, caps at 500 tokens)
        factors['token_count'] = min(token_count / 500, 1.0)
        
        # Code keywords factor
        code_matches = sum(1 for kw in self.CODE_KEYWORDS if kw.lower() in query_lower)
        factors['code_keywords'] = min(code_matches / 5, 1.0)
        
        # Research markers factor
        research_matches = sum(1 for rm in self.RESEARCH_MARKERS if rm.lower() in query_lower)
        factors['research_markers'] = min(research_matches / 3, 1.0)
        
        # Multimodal factor
        factors['multimodal'] = 1.0 if (has_image or has_screen) else 0.0
        
        # Context length factor (normalized to 0-1, caps at 2000 tokens)
        factors['context_length'] = min(context_tokens / 2000, 1.0)
        
        # Calculate weighted score
        score = sum(
            factors[factor] * weight
            for factor, weight in self.WEIGHTS.items()
        )
        
        # Determine recommendation
        recommendation = self._get_recommendation(query_lower, score, factors)
        
        # Generate reasoning explanation
        reasoning = self._generate_reasoning(query, score, factors, recommendation)
        
        return ComplexityScore(
            score=round(score, 3),
            factors=factors,
            recommendation=recommendation,
            reasoning=reasoning,
        )

    
    def _get_recommendation(
        self,
        query_lower: str,
        score: float,
        factors: dict[str, float],
    ) -> str:
        """Determine which model should handle the query"""
        
        # Check for Claude-preferred tasks (heavy coding)
        claude_matches = sum(1 for cm in self.CLAUDE_MARKERS if cm in query_lower)
        if claude_matches >= 2 or factors['code_keywords'] > 0.6:
            return 'claude'
        
        # Multimodal queries prefer Gemini
        if factors['multimodal'] > 0:
            return 'gemini'
        
        # Low complexity → local/simple response
        if score < self.threshold:
            return 'local'
        
        # High complexity without specific markers → Gemini (fastest)
        return 'gemini'
    
    def _generate_reasoning(
        self,
        query: str,
        score: float,
        factors: dict[str, float],
        recommendation: str,
    ) -> str:
        """Generate human-readable reasoning for the routing decision"""
        
        # Identify primary factors
        high_factors = [k for k, v in factors.items() if v > 0.5]
        
        # Build reasoning based on decision
        if recommendation == 'local':
            if score < 0.2:
                return "Ultra-low complexity. Handling locally with simple response."
            else:
                return f"Low complexity (score: {score:.2f}). Routing to local handler."
        
        elif recommendation == 'gemini':
            if factors.get('multimodal', 0) > 0:
                return "Multimodal content detected. Routing to Gemini for image analysis."
            elif score > 0.7:
                return f"High complexity (score: {score:.2f}). Routing to Gemini for fast cloud processing."
            else:
                return "Medium complexity. Gemini selected for speed and versatility."
        
        elif recommendation == 'claude':
            code_score = factors.get('code_keywords', 0)
            if code_score > 0.6:
                return f"Heavy code task detected ({int(code_score * 10)}/10 code markers). Routing to Claude for deep implementation."
            else:
                return "Complex analysis task. Claude selected for structured reasoning."
        
        elif recommendation == 'ollama':
            return f"Local model preferred. Complexity score: {score:.2f}"
        
        # Fallback
        return f"Routing to {recommendation.upper()} (complexity: {score:.2f})"



# Singleton instance
scorer = ComplexityScorer()
