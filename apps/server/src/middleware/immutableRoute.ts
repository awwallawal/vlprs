import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';

const BLOCKED_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);

/**
 * Express middleware that rejects PUT, PATCH, DELETE on immutable resource routes.
 * Layer 3 of the 3-layer immutability defence.
 */
export function immutableRoute(req: Request, res: Response, next: NextFunction): void {
  if (BLOCKED_METHODS.has(req.method)) {
    res.setHeader('Allow', 'GET, POST, HEAD, OPTIONS');
    throw new AppError(405, 'METHOD_NOT_ALLOWED', VOCABULARY.LEDGER_METHOD_NOT_ALLOWED);
  }
  next();
}
