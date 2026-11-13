
from openai import OpenAI
import os

api_key = os.getenv('GROQ_API_KEY', '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')

client = OpenAI(
    api_key=api_key,
    base_url="https://api.groq.com/openai/v1",
)

if __name__ == "__main__":
    user_input = input('What is your question: ')
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": user_input}],
        max_tokens=1000
    )
    print("\nAnswer:\n", response.choices[0].message.content)
