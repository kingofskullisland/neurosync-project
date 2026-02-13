#!/usr/bin/env python3
"""
NeuroSync Backend - Comprehensive Test Suite
Tests all API endpoints and validates Ollama integration
"""

import asyncio
import httpx
import json
import os
from typing import Dict, Any


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class NeuroSyncTester:
    def __init__(self, base_url: str = "http://127.0.0.1:8082"):
        self.base_url = base_url
        self.results = {
            "passed": 0,
            "failed": 0,
            "warnings": 0
        }
    
    def log_test(self, name: str, status: str, message: str = ""):
        """Log test result with color coding"""
        if status == "PASS":
            print(f"{Colors.GREEN}✓{Colors.RESET} {name}")
            if message:
                print(f"  → {message}")
            self.results["passed"] += 1
        elif status == "FAIL":
            print(f"{Colors.RED}✗{Colors.RESET} {name}")
            if message:
                print(f"  → {Colors.RED}{message}{Colors.RESET}")
            self.results["failed"] += 1
        elif status == "WARN":
            print(f"{Colors.YELLOW}⚠{Colors.RESET} {name}")
            if message:
                print(f"  → {Colors.YELLOW}{message}{Colors.RESET}")
            self.results["warnings"] += 1
    
    def print_header(self, title: str):
        """Print section header"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{title}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}\n")
    
    async def test_health_endpoint(self):
        """Test /health endpoint"""
        self.print_header("Testing Health Endpoint")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/health", timeout=5.0)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Check bridge status
                    if data.get("bridge") == "online":
                        self.log_test("Bridge Status", "PASS", "Bridge is online")
                    else:
                        self.log_test("Bridge Status", "FAIL", f"Bridge status: {data.get('bridge')}")
                    
                    # Check Ollama status
                    ollama_status = data.get("ollama")
                    if ollama_status == "online":
                        self.log_test("Ollama Status", "PASS", "Ollama is online")
                    elif ollama_status == "offline":
                        self.log_test("Ollama Status", "WARN", "Ollama is offline - check OLLAMA_BASE_URL")
                    else:
                        self.log_test("Ollama Status", "FAIL", f"Unexpected status: {ollama_status}")
                    
                    print(f"\n  Response: {json.dumps(data, indent=2)}")
                else:
                    self.log_test("Health Endpoint", "FAIL", f"Status code: {response.status_code}")
                    
        except httpx.ConnectError:
            self.log_test("Health Endpoint", "FAIL", "Cannot connect to server - is it running?")
        except Exception as e:
            self.log_test("Health Endpoint", "FAIL", str(e))
    
    async def test_models_endpoint(self):
        """Test /models endpoint"""
        self.print_header("Testing Models Endpoint")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/models", timeout=10.0)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if "models" in data:
                        models = data["models"]
                        if models:
                            self.log_test("Models List", "PASS", f"Found {len(models)} model(s)")
                            for model in models:
                                print(f"  • {model}")
                        else:
                            self.log_test("Models List", "WARN", "No models available")
                    elif "error" in data:
                        self.log_test("Models List", "FAIL", f"Error: {data['error']}")
                    
                    print(f"\n  Response: {json.dumps(data, indent=2)}")
                else:
                    self.log_test("Models Endpoint", "FAIL", f"Status code: {response.status_code}")
                    
        except Exception as e:
            self.log_test("Models Endpoint", "FAIL", str(e))
    
    async def test_score_endpoint(self):
        """Test /score endpoint"""
        self.print_header("Testing Score Endpoint")
        
        test_queries = [
            ("What is 2+2?", "Simple query"),
            ("Explain quantum entanglement in detail", "Complex query"),
            ("Show me a picture of a cat", "Image request"),
        ]
        
        try:
            async with httpx.AsyncClient() as client:
                for query, description in test_queries:
                    response = await client.get(
                        f"{self.base_url}/score",
                        params={"query": query},
                        timeout=5.0
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        score = data.get("score", 0)
                        recommendation = data.get("recommendation", "unknown")
                        
                        self.log_test(
                            f"Score Query: {description}", 
                            "PASS", 
                            f"Score: {score:.2f}, Route: {recommendation}"
                        )
                    else:
                        self.log_test(f"Score Query: {description}", "FAIL", 
                                    f"Status: {response.status_code}")
                        
        except Exception as e:
            self.log_test("Score Endpoint", "FAIL", str(e))
    
    async def test_chat_endpoint(self):
        """Test /chat endpoint (non-streaming)"""
        self.print_header("Testing Chat Endpoint")
        
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    "prompt": "Say 'Hello from NeuroSync!' and nothing else.",
                    "model": "llama3.2:3b"
                }
                
                print(f"  Sending: {payload['prompt']}")
                
                response = await client.post(
                    f"{self.base_url}/chat",
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    self.log_test("Chat Response", "PASS", f"Route: {data.get('route')}")
                    print(f"\n  Response: {data.get('response', 'No response')[:200]}")
                    print(f"  Complexity: {data.get('complexity')}")
                    print(f"  Reasoning: {data.get('reasoning')}")
                    print(f"  Persona: {data.get('persona')}")
                else:
                    self.log_test("Chat Endpoint", "FAIL", f"Status: {response.status_code}")
                    print(f"  {response.text}")
                    
        except httpx.ReadTimeout:
            self.log_test("Chat Endpoint", "FAIL", "Request timed out - Ollama may be slow or offline")
        except Exception as e:
            self.log_test("Chat Endpoint", "FAIL", str(e))
    
    async def test_ollama_direct(self):
        """Test direct Ollama connectivity"""
        self.print_header("Testing Direct Ollama Connectivity")
        
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11435")
        print(f"  Testing: {ollama_url}")
        
        try:
            async with httpx.AsyncClient() as client:
                # Test /api/tags
                response = await client.get(f"{ollama_url}/api/tags", timeout=5.0)
                
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("models", [])
                    
                    self.log_test("Ollama /api/tags", "PASS", f"Found {len(models)} model(s)")
                    for model in models:
                        print(f"  • {model.get('name')} ({model.get('size', 0) / 1e9:.2f} GB)")
                else:
                    self.log_test("Ollama /api/tags", "FAIL", f"Status: {response.status_code}")
                    
        except httpx.ConnectError:
            self.log_test("Ollama Connection", "FAIL", 
                         f"Cannot connect to {ollama_url} - is Ollama running?")
        except Exception as e:
            self.log_test("Ollama Connection", "FAIL", str(e))
    
    async def test_environment_config(self):
        """Test environment configuration"""
        self.print_header("Environment Configuration")
        
        ollama_url = os.getenv("OLLAMA_BASE_URL", "Not set (using default)")
        print(f"  OLLAMA_BASE_URL: {ollama_url}")
        
        if ollama_url == "Not set (using default)":
            self.log_test("OLLAMA_BASE_URL", "WARN", 
                         "Not set - using default from config.py")
        else:
            self.log_test("OLLAMA_BASE_URL", "PASS", ollama_url)
    
    def print_summary(self):
        """Print test summary"""
        self.print_header("Test Summary")
        
        total = self.results["passed"] + self.results["failed"]
        
        print(f"  {Colors.GREEN}Passed:{Colors.RESET}   {self.results['passed']}")
        print(f"  {Colors.RED}Failed:{Colors.RESET}   {self.results['failed']}")
        print(f"  {Colors.YELLOW}Warnings:{Colors.RESET} {self.results['warnings']}")
        print(f"  Total:    {total}\n")
        
        if self.results["failed"] == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}🎉 All critical tests passed!{Colors.RESET}\n")
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ {self.results['failed']} test(s) failed{Colors.RESET}\n")
    
    async def run_all_tests(self):
        """Run all test suites"""
        print(f"\n{Colors.BOLD}{'=' * 60}{Colors.RESET}")
        print(f"{Colors.BOLD}NeuroSync Backend - Comprehensive Test Suite{Colors.RESET}")
        print(f"{Colors.BOLD}{'=' * 60}{Colors.RESET}\n")
        
        await self.test_environment_config()
        await self.test_ollama_direct()
        await self.test_health_endpoint()
        await self.test_models_endpoint()
        await self.test_score_endpoint()
        await self.test_chat_endpoint()
        
        self.print_summary()


async def main():
    tester = NeuroSyncTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
