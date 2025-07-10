import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Highlight, themes } from 'prism-react-renderer';

interface MarkdownRendererProps {
    content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    // Code renderer component for markdown code blocks
    const CodeBlock = ({ language, value }: { language: string, value: string; }) => {
        return (
            <Highlight
                theme={themes.vsDark}
                code={value}
                language={language || 'javascript'}
            >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre className={className} style={{
                        ...style,
                        padding: '12px',
                        borderRadius: '6px',
                        overflow: 'auto',
                        fontSize: '13px',
                        fontWeight: 500,
                        maxWidth: '100%',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        wordBreak: 'break-all',
                        tabSize: 2,
                        marginTop: '8px',
                        marginBottom: '8px',
                        backgroundColor: '#1e1e1e',
                        border: '1px solid #333'
                    }}>
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line, key: i })}>
                                <span style={{
                                    color: '#666',
                                    userSelect: 'none',
                                    paddingRight: '16px',
                                    minWidth: '40px',
                                    textAlign: 'right',
                                    display: 'inline-block',
                                    fontSize: '13px',
                                    fontWeight: 400
                                }}>
                                    {i + 1}
                                </span>
                                <span style={{ whiteSpace: 'pre-wrap', fontWeight: 500 }}>
                                    {line.map((token, key) => (
                                        <span key={key} {...getTokenProps({ token, key })} />
                                    ))}
                                </span>
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        );
    };

    // Markdown components to override
    const components = {
        code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                <CodeBlock
                    language={match[1]}
                    value={String(children).replace(/\n$/, '')}
                />
            ) : (
                <code
                    className={className}
                    style={{
                        fontWeight: 500,
                        fontSize: '13px',
                        background: 'rgba(45, 45, 50, 0.8)',
                        color: '#e6e6e6',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #444'
                    }}
                    {...props}
                >
                    {children}
                </code>
            );
        },
        // Style headings
        h1: ({ children, ...props }: any) => (
            <h1 style={{
                color: '#ffffff',
                fontSize: '24px',
                fontWeight: 'bold',
                marginTop: '16px',
                marginBottom: '12px',
                borderBottom: '2px solid #444',
                paddingBottom: '8px'
            }} {...props}>
                {children}
            </h1>
        ),
        h2: ({ children, ...props }: any) => (
            <h2 style={{
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 'bold',
                marginTop: '16px',
                marginBottom: '10px',
                borderBottom: '1px solid #444',
                paddingBottom: '6px'
            }} {...props}>
                {children}
            </h2>
        ),
        h3: ({ children, ...props }: any) => (
            <h3 style={{
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: 'bold',
                marginTop: '14px',
                marginBottom: '8px'
            }} {...props}>
                {children}
            </h3>
        ),
        h4: ({ children, ...props }: any) => (
            <h4 style={{
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: 'bold',
                marginTop: '12px',
                marginBottom: '8px'
            }} {...props}>
                {children}
            </h4>
        ),
        // Style paragraphs
        p: ({ children, ...props }: any) => (
            <p style={{
                color: '#e6e6e6',
                marginBottom: '12px',
                lineHeight: '1.6'
            }} {...props}>
                {children}
            </p>
        ),
        // Style lists
        ul: ({ children, ...props }: any) => (
            <ul style={{
                color: '#e6e6e6',
                marginBottom: '12px',
                paddingLeft: '20px'
            }} {...props}>
                {children}
            </ul>
        ),
        ol: ({ children, ...props }: any) => (
            <ol style={{
                color: '#e6e6e6',
                marginBottom: '12px',
                paddingLeft: '20px'
            }} {...props}>
                {children}
            </ol>
        ),
        li: ({ children, ...props }: any) => (
            <li style={{
                color: '#e6e6e6',
                marginBottom: '4px',
                lineHeight: '1.6'
            }} {...props}>
                {children}
            </li>
        ),
        // Style blockquotes
        blockquote: ({ children, ...props }: any) => (
            <blockquote style={{
                borderLeft: '4px solid #0078d4',
                paddingLeft: '16px',
                marginLeft: '0',
                marginBottom: '12px',
                fontStyle: 'italic',
                color: '#cccccc',
                backgroundColor: 'rgba(0, 120, 212, 0.1)',
                padding: '12px 16px',
                borderRadius: '4px'
            }} {...props}>
                {children}
            </blockquote>
        ),
        // Style strong/bold text
        strong: ({ children, ...props }: any) => (
            <strong style={{
                color: '#ffffff',
                fontWeight: 'bold'
            }} {...props}>
                {children}
            </strong>
        ),
        // Style emphasis/italic text
        em: ({ children, ...props }: any) => (
            <em style={{
                color: '#ffffff',
                fontStyle: 'italic'
            }} {...props}>
                {children}
            </em>
        )
    };

    return (
        <div style={{
            color: '#e6e6e6',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <ReactMarkdown components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownRenderer;