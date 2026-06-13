export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, occasion, relationship, keywords, tone, tier } = req.body;

  const basePrompt = `Generate a 5x5 bingo card of personalized compliments for a person named "${name}". Occasion: ${occasion}. Relationship: ${relationship}. Their interests: ${keywords}. Tone: ${tone}. The center cell must be "FREE SPACE — ${name}". Each cell should be 2-8 words, heartfelt and specific. Return ONLY a valid JSON array of 25 strings, row by row (first 5 = row 1, next 5 = row 2, etc.). No other text.`;

  let systemMessage = 'You generate personalized bingo card compliments. Always return valid JSON.';

  if (tier === 'deluxe' || tier === 'premium') {
    systemMessage = 'You generate personalized bingo card compliments and poems. Return valid JSON with cells array. For premium/deluxe, also include a "poem" field with a short 4-line poem about the recipient.';
  }

  const prompt = tier === 'deluxe'
    ? `${basePrompt}\n\nAlso include a "memory" field with a 3-sentence paragraph weaving the compliments into a story about ${name}. Return as JSON with "cells" (array of 25), "poem" (string), and "memory" (string).`
    : tier === 'premium'
    ? `${basePrompt}\n\nAlso include a "poem" field with a short 4-line rhyming poem about ${name}. Return as JSON with "cells" (array of 25) and "poem" (string).`
    : basePrompt;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI API error' });
    }

    const content = data.choices[0].message.content;
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    const result = { cells: parsed.cells || parsed };
    if (parsed.poem) result.poem = parsed.poem;
    if (parsed.memory) result.memory = parsed.memory;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate bingo card' });
  }
}
