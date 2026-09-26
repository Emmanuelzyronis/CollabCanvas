'use client';
import { useState, useEffect } from 'react';
export type ToastVariant = 'success' | 'error' | 'info';
export interface ToastItem { id: string; message: string; variant: ToastVariant; }
type Listener = (t: ToastItem[]) => void;
let _toasts: ToastItem[] = [];
let _listeners: Listener[] = [];
function _notify() { _listeners.forEach(l => l([..._toasts])); }
export function toast(message: string, variant: ToastVariant = 'success') {
  const id = Math.random().toString(36).slice(2, 9);
  _toasts = [..._toasts, { id, message, variant }];
  _notify();
  setTimeout(() => { _toasts = _toasts.filter(t => t.id !== id); _notify(); }, 4000);
}
export function useToasts() {
  const [state, setState] = useState<ToastItem[]>(_toasts);
  useEffect(() => { _listeners.push(setState); return () => { _listeners = _listeners.filter(l => l !== setState); }; }, []);
  return state;
}
