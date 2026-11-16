import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
// A fonte do design system. Ate aqui ela era declarada em styles.css e no
// DESIGN.md e nunca carregada, entao o ERP inteiro renderizava no fallback do
// sistema. A Inter entrou primeiro, por ser a que o documento pedia; a Geist
// veio depois por escolha da Andressa: numeral de largura fixa nativo, que e o
// que uma tela cheia de valor em coluna precisa.
import '@fontsource-variable/geist';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* `reducedMotion="user"` faz o framer-motion respeitar a preferencia do
        sistema. O bloco em styles.css ja zerava animacao e transicao CSS, mas
        todo o movimento do app (sidebar, gaveta de IA, paleta, modal) e
        framer-motion, que escreve transform por JS e passava direto por ele:
        com "reduzir movimento" ligado, tudo continuava deslizando. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>,
);
