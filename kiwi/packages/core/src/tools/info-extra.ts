import { z } from 'zod';
import { convertUnits, evaluate, roundForSpeech } from '../files/convert';
import { wrapUntrusted } from '../safety';
import { defineTool } from './types';

const geocodeSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});
const forecastSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
  }),
});

const weatherText = (code: number): string => {
  if (code === 0) return 'clear';
  if (code <= 3) return 'partly cloudy';
  if (code <= 48) return 'foggy';
  if (code <= 67) return 'rainy';
  if (code <= 77) return 'snowy';
  return 'stormy';
};

export const getWeather = defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a city (Open-Meteo, no key).',
  risk: 'read',
  argsSchema: z.object({ city: z.string().min(2).max(80) }),
  describe: ({ city }) => `Check the weather in ${city}`,
  async execute({ city }, { services }) {
    const geo = await services.web.fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
    );
    if (!geo.ok) return { ok: false, message: geo.message };
    const place = geocodeSchema.safeParse(geo.json);
    const found = place.success ? place.data.results?.[0] : undefined;
    if (!found) return { ok: false, message: `I couldn't find a place called “${city}”.` };
    const forecast = await services.web.fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${found.latitude}&longitude=${found.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
    );
    if (!forecast.ok) return { ok: false, message: forecast.message };
    const now = forecastSchema.safeParse(forecast.json);
    if (!now.success)
      return { ok: false, message: 'The weather service sent an unexpected answer.' };
    const {
      temperature_2m: temperature,
      weather_code: code,
      wind_speed_10m: wind,
    } = now.data.current;
    const text = `${found.name}: ${weatherText(code)}, ${Math.round(temperature)}°C, wind ${Math.round(wind)} km/h`;
    return { ok: true, summary: text };
  },
});

export const calculate = defineTool({
  name: 'calculate',
  description:
    'Evaluate plain arithmetic like "12 * (3 + 4)". Use this instead of doing maths yourself.',
  risk: 'read',
  argsSchema: z.object({ expression: z.string().min(1).max(200) }),
  describe: ({ expression }) => `Calculate ${expression}`,
  execute({ expression }) {
    const value = evaluate(expression);
    return Promise.resolve(
      value === null
        ? { ok: false, message: `“${expression}” is not arithmetic I can calculate.` }
        : { ok: true, summary: `${expression} = ${roundForSpeech(value)}` },
    );
  },
});

export const convertUnitsTool = defineTool({
  name: 'convert_units',
  description: 'Convert a value between length, mass, volume or temperature units.',
  risk: 'read',
  argsSchema: z.object({
    value: z.number(),
    from: z.string().min(1).max(20),
    to: z.string().min(1).max(20),
  }),
  describe: ({ value, from, to }) => `Convert ${value} ${from} to ${to}`,
  execute({ value, from, to }) {
    const result = convertUnits(value, from, to);
    return Promise.resolve(
      result === null
        ? { ok: false, message: `I can't convert ${from} to ${to}.` }
        : { ok: true, summary: `${value} ${from} = ${roundForSpeech(result)} ${to}` },
    );
  },
});

export const translate = defineTool({
  name: 'translate',
  description: 'Translate text into another language using the local model.',
  risk: 'read',
  argsSchema: z.object({ text: z.string().min(1).max(500), language: z.string().min(2).max(30) }),
  describe: ({ language }) => `Translate to ${language}`,
  async execute({ text, language }, { services }) {
    const prompt = `Translate the text to ${language}. Reply with only the translation.\n${wrapUntrusted('user text', text)}`;
    const result = await services.model.generate('fast', prompt);
    return result.ok
      ? { ok: true, summary: `Translated to ${language}`, say: result.text.trim() }
      : { ok: false, message: result.message };
  },
});

export const define = defineTool({
  name: 'define',
  description: 'Define a word or short phrase in one sentence using the local model.',
  risk: 'read',
  argsSchema: z.object({ word: z.string().min(1).max(60) }),
  describe: ({ word }) => `Define “${word}”`,
  async execute({ word }, { services }) {
    const result = await services.model.generate('fast', `Define "${word}" in one short sentence.`);
    return result.ok
      ? { ok: true, summary: `Defined “${word}”`, say: result.text.trim() }
      : { ok: false, message: result.message };
  },
});
