export interface SampleDocument {
  id: string;
  title: string;
  subjectTag: string;
  description: string;
  rawText: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'astronomia-eclipses',
    title: 'Geometria dos Eclipses: Sol, Terra, Lua e Cones de Sombra',
    subjectTag: 'Astronomia e Óptica Geométrica',
    description:
      'Estudo sobre alinhamentos celestes (sizígia), formação de umbra e penumbra em eclipses solares e lunares, e o papel da inclinação orbital de 5,14°.',
    rawText: `[Página 1]
Seção 1: O que é um Eclipse Solar e a Geometria da Sombra
Um eclipse solar ocorre exclusivamente durante a fase de Lua Nova, quando a Lua se posiciona exatamente entre o Sol e a Terra (ordem Sol – Lua – Terra). Como o Sol é uma fonte extensa de luz e não um ponto único, o bloqueio da luz solar pela Lua projeta dois cones distintos de sombra no sentido oposto ao Sol, estendendo-se atrás da Lua em direção à superfície terrestre:
1. Umbra: Região central e escura do cone de sombra onde o disco lunar bloqueia 100% da luz direta da fotosfera solar. Um observador posicionado dentro da mancha da umbra na Terra vivencia um Eclipse Solar Total, vendo a coroa solar ao redor da silhueta escura da Lua.
2. Penumbra: Região externa e parcialmente iluminada ao redor da umbra, onde a Lua encobre apenas uma fração do disco solar. Um observador na penumbra enxerga um Eclipse Solar Parcial. Portanto, durante o mesmo evento astronômico, o que você vê depende de onde está localizado na Terra.

[Página 2]
Seção 2: Eclipse Lunar — A Terra entre o Sol e a Lua
Em contraste direto com o eclipse solar, o eclipse lunar acontece apenas na fase de Lua Cheia, quando a Terra se posiciona entre o Sol e a Lua (ordem Sol – Terra – Lua). Nesse alinhamento, a Terra bloqueia a luz solar e projeta sua própria umbra e penumbra no espaço atrás de si, no sentido oposto ao Sol.
Quando a Lua atravessa a umbra da Terra, ocorre o Eclipse Lunar Total. Como o diâmetro da Terra é cerca de 3,7 vezes maior que o da Lua, o cone de umbra terrestre é muito mais largo na distância orbital lunar, fazendo com que um eclipse lunar seja visível de todo o hemisfério noturno da Terra simultaneamente. A Lua adquire um tom avermelhado (coral/cobre) devido à refração da luz solar pela atmosfera terrestre.

[Página 3]
Seção 3: Por que não há eclipses todos os meses? A Inclinação Orbital
Se a Lua completa uma órbita ao redor da Terra a cada 29,5 dias (passando por uma Lua Nova e uma Lua Cheia a cada ciclo), por que não ocorrem eclipses todo mês?
A resposta está na inclinação orbital: o plano da órbita da Lua ao redor da Terra é inclinado em aproximadamente 5,14 graus em relação ao plano da eclíptica (o plano da órbita da Terra ao redor do Sol).
Na maioria das Luas Novas e Luas Cheias, a Lua passa ligeiramente acima ou abaixo da linha que liga o Sol e a Terra, e os cones de umbra e penumbra passam pelo espaço sem atingir o outro corpo. Os eclipses só acontecem quando a Lua Nova ou Cheia coincide com a passagem da Lua pelos "nodos orbitais" — os dois pontos onde o plano orbital lunar cruza o plano da eclíptica.`
  },
  {
    id: 'fisiologia-vegetal-xilema-floema',
    title: 'Sistemas Vasculares das Plantas: Transporte no Xilema e Floema',
    subjectTag: 'Biologia e Fisiologia Vegetal',
    description:
      'Comparação funcional, estrutural e biofísica entre a condução ascendente de seiva bruta no xilema e o fluxo por pressão de seiva elaborada no floema.',
    rawText: `Seção 1: Arquitetura Vascular e Diferenciação entre Xilema e Floema
As plantas vasculares (traqueófitas) dependem de dois tecidos condutores especializados que operam em conjunto, mas com mecanismos físicos e direções distintas:
- Xilema (Lenho): Responsável pelo transporte unidirecional ascendente (das raízes até as folhas) da seiva bruta, composta por água e sais minerais inorgânicos absorvidos do solo. Suas principais células condutoras (elementos de vaso e traqueídes) são células mortas na maturidade, com paredes espessadas por lignina para suportar pressões negativas extremas sem colapsar.
- Floema (Líber): Responsável pelo transporte bidirecional (da fonte para o dreno) da seiva elaborada, rica em sacarose, aminoácidos e hormônios produzidos na fotossíntese. Seus tubos crivados são células vivas anucleadas apoiadas por células companheiras metabolicamente ativas.

Seção 2: Mecanismo de Coesão-Tensão no Xilema (Teoria de Dixon)
Como a água sobe dezenas de metros até a copa das árvores sem uma bomba mecânica? O motor principal é a transpiração foliar:
1. A evaporação de moléculas de água pelos estômatos das folhas gera uma tensão (pressão hidrostática negativa) nos meniscos das paredes celulares do mesofilo.
2. Devido à forte coesão entre as moléculas de água (pontes de hidrogênio) e à adesão às paredes hidrofílicas de celulose e lignina do xilema, forma-se uma coluna contínua de água que é puxada para cima desde as raízes.
3. Dados típicos de velocidade e pressão: Em pleno sol (transpiração alta), o fluxo no xilema atinge velocidades de 15 a 45 metros por hora com tensão de -1,5 MPa. À noite (estômatos fechados), o fluxo cai para cerca de 2 metros por hora.

Seção 3: Hipótese do Fluxo por Pressão no Floema (Modelo de Münch)
Diferente do xilema que opera sob tensão negativa, o floema opera sob pressão hidrostática positiva gerada por gradientes osmóticos entre órgãos Fonte (folhas maduras fotossintetizantes) e órgãos Dreno (raízes, frutos em crescimento, tubérculos):
1. Carregamento do Floema na Fonte: As células companheiras transportam ativamente sacarose para dentro dos elementos de tubo crivado. O aumento da concentração de açúcar reduz o potencial hídrico, atraindo água do xilema adjacente por osmose e elevando a pressão de turgor.
2. Descarregamento no Dreno: Nos tecidos consumidores ou de reserva, a sacarose é retirada do floema. Com a saída do açúcar, a água retorna ao xilema, reduzindo a pressão local e mantendo o fluxo em massa da fonte para o dreno.`
  }
];
