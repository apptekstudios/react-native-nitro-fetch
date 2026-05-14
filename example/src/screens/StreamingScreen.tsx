import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { fetch as nitroFetch } from 'react-native-nitro-fetch';
import { TextDecoder } from 'react-native-nitro-text-decoder';
import { theme } from '../theme';

export function StreamingScreen() {
  const [output, setOutput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [activeTest, setActiveTest] = React.useState<string | null>(null);
  const decoder = React.useRef(new TextDecoder());
  const abortRef = React.useRef<AbortController | null>(null);

  const append = (text: string) => {
    setOutput((prev) => prev + text);
  };

  const reset = () => {
    setOutput('');
    decoder.current = new TextDecoder();
  };
  console.log('TextDecoder', TextDecoder);
  const stopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setActiveTest(null);
    append('\n\n[Cancelled]');
  };

  const runTest = async (id: string, fn: () => Promise<void>) => {
    reset();
    setStreaming(true);
    setActiveTest(id);
    abortRef.current = new AbortController();
    try {
      await fn();
    } finally {
      setStreaming(false);
      setActiveTest(null);
    }
  };

  const tests = [
    {
      id: 'stream-lines',
      title: 'Stream 20 JSON lines',
      description: 'httpbin /stream/20 — each line arrives as a chunk',
      action: () =>
        runTest('stream-lines', async () => {
          const res = await (nitroFetch as any)(
            'https://httpbin.org/stream/20',
            { stream: true, signal: abortRef.current?.signal }
          );
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let chunkCount = 0;
          console.log('Console');
          while (true) {
            try {
              const { done, value } = await reader.read();
              console.log('value', value);
              if (done) break;
              chunkCount++;
              const text = decoder.current.decode(value, { stream: true });
              append(text);
            } catch (error) {
              console.error('error', error);
              break;
            }
          }
          append(`\n\n✅ Done — ${chunkCount} chunk(s) received`);
        }),
    },
    {
      id: 'stream-bytes',
      title: 'Stream drip (slow server)',
      description: 'httpbin /drip — bytes arrive over 5s',
      action: () =>
        runTest('stream-bytes', async () => {
          const res = await (nitroFetch as any)(
            'https://httpbin.org/drip?duration=5&numbytes=100&delay=0',
            { stream: true, signal: abortRef.current?.signal }
          );
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value?.byteLength ?? 0;
            append(`Received ${value?.byteLength} bytes (total: ${total})\n`);
          }
          append(`\n✅ Done — ${total} bytes total`);
        }),
    },
    {
      id: 'stream-large',
      title: 'Stream large response',
      description: 'httpbin /bytes/65536 — 64KB streamed in chunks',
      action: () =>
        runTest('stream-large', async () => {
          const res = await (nitroFetch as any)(
            'https://httpbin.org/bytes/65536',
            { stream: true, signal: abortRef.current?.signal }
          );
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let total = 0;
          let chunks = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks++;
            total += value?.byteLength ?? 0;
            append(`Chunk ${chunks}: ${value?.byteLength} bytes\n`);
          }
          append(`\n✅ Done — ${chunks} chunks, ${total} bytes total`);
        }),
    },
    {
      id: 'stream-formdata',
      title: 'Streaming POST with FormData',
      description: 'Multipart upload to httpbin /post with streamed response',
      action: () =>
        runTest('stream-formdata', async () => {
          const form = new FormData();
          form.append('greeting', 'hello from nitro-fetch');
          form.append('count', '42');
          form.append('document', {
            uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'application/pdf',
            name: 'test_document.pdf',
          } as any);
          const res = await (nitroFetch as any)('https://httpbin.org/post', {
            method: 'POST',
            stream: true,
            body: form,
            signal: abortRef.current?.signal,
          });
          append(`Status: ${res.status}\n\n`);
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value?.byteLength ?? 0;
            const text = decoder.current.decode(value, { stream: true });
            append(text);
          }
          append(`\n\n✅ Done — ${total} bytes total`);
        }),
    },
    {
      id: 'stream-urlsearchparams',
      title: 'Streaming POST with URLSearchParams',
      description:
        'httpbin /post — Content-Type set to application/x-www-form-urlencoded',
      action: () =>
        runTest('stream-urlsearchparams', async () => {
          const params = new URLSearchParams();
          params.append('greeting', 'hello from nitro-fetch');
          params.append('count', '42');
          const res = await (nitroFetch as any)('https://httpbin.org/post', {
            method: 'POST',
            stream: true,
            body: params,
            signal: abortRef.current?.signal,
          });
          append(`Status: ${res.status}\n\n`);
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value?.byteLength ?? 0;
            const text = decoder.current.decode(value, { stream: true });
            append(text);
          }
          append(`\n\n✅ Done — ${total} bytes total`);
        }),
    },
    {
      id: 'stream-uint8array',
      title: 'Streaming POST with Uint8Array',
      description: 'httpbin /post — raw byte body round-trip',
      action: () =>
        runTest('stream-uint8array', async () => {
          const payload = new Uint8Array(256);
          for (let i = 0; i < payload.length; i++) payload[i] = i;
          const res = await (nitroFetch as any)('https://httpbin.org/post', {
            method: 'POST',
            stream: true,
            headers: { 'Content-Type': 'application/octet-stream' },
            body: payload,
            signal: abortRef.current?.signal,
          });
          append(`Status: ${res.status}\nSent ${payload.byteLength} bytes\n\n`);
          const reader = res.body?.getReader();
          if (!reader) {
            append('No readable stream!');
            return;
          }
          let total = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value?.byteLength ?? 0;
            const text = decoder.current.decode(value, { stream: true });
            append(text);
          }
          append(`\n\n✅ Done — ${total} bytes total`);
        }),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        {tests.map((test) => (
          <Pressable
            key={test.id}
            style={({ pressed }) => [
              styles.card,
              activeTest === test.id && styles.cardActive,
              pressed && !streaming && styles.cardPressed,
            ]}
            onPress={streaming ? undefined : test.action}
            disabled={streaming && activeTest !== test.id}
          >
            <Text style={styles.cardTitle}>{test.title}</Text>
            <Text style={styles.cardDesc}>{test.description}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.consoleWrapper}>
        <View style={styles.consoleHeader}>
          <View style={styles.consoleHeaderLeft}>
            <Text style={styles.consoleTitle}>Stream Output</Text>
            {streaming && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={styles.spinner}
              />
            )}
          </View>
          {streaming ? (
            <Pressable onPress={stopStream}>
              <Text style={styles.stopText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable onPress={reset}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>
        <ScrollView style={styles.consoleArea}>
          {output ? (
            <Text style={styles.outputText}>{output}</Text>
          ) : (
            <Text style={styles.emptyConsole}>
              Tap a test to start streaming...
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  buttonRow: {
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  cardActive: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  consoleWrapper: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#141414',
  },
  consoleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  consoleTitle: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '600',
  },
  spinner: {
    transform: [{ scale: 0.8 }],
  },
  clearText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  stopText: {
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  consoleArea: {
    padding: theme.spacing.md,
  },
  outputText: {
    color: '#E0E0E0',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyConsole: {
    color: '#555',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
