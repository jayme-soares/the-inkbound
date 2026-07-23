use std::path::PathBuf;

use docx_rs::{
    AlignmentType, Docx, Header, LineSpacing, LineSpacingType, PageMargin, PageNum, Paragraph,
    Run, RunFonts,
};
use serde::Deserialize;

// Payload estruturado montado no lado JS (src/lib/exportarManuscrito.js) a
// partir dos tokens do `marked` — mantém um único parser de Markdown no
// projeto (o mesmo já usado no preview do editor) em vez de reimplementar a
// interpretação de negrito/itálico/quebra de cena aqui em Rust.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manuscrito {
    pub titulo: String,
    pub autor: String,
    pub contato: String,
    pub contagem_palavras: u32,
    pub capitulos: Vec<Capitulo>,
}

#[derive(Deserialize)]
pub struct Capitulo {
    pub titulo: String,
    pub blocos: Vec<Bloco>,
}

#[derive(Deserialize)]
#[serde(tag = "tipo", rename_all = "camelCase")]
pub enum Bloco {
    Paragrafo { runs: Vec<Run_> },
    Titulo { runs: Vec<Run_> },
    // O JS sempre envia `runs: []` junto (mesmo formato dos outros blocos),
    // mas o conteúdo é irrelevante aqui — serde ignora o campo extra.
    QuebraCena,
}

// Renomeado para não colidir com docx_rs::Run (o tipo do payload é só dados;
// o Run de verdade do docx-rs é construído a partir dele).
#[derive(Deserialize)]
pub struct Run_ {
    pub texto: String,
    pub negrito: bool,
    pub italico: bool,
}

const TAMANHO_FONTE_CORPO: usize = 24; // 12pt, em meios-pontos (convenção OOXML)
const TAMANHO_FONTE_TITULO: usize = 32; // 16pt
const MARGEM_TWIPS: i32 = 1701; // 3cm
const FONTE: &str = "Times New Roman";

fn fonte_docx() -> RunFonts {
    RunFonts::new().ascii(FONTE)
}

fn paragrafo_simples_docx(texto: &str, tamanho: usize, alinhamento: AlignmentType) -> Paragraph {
    Paragraph::new()
        .align(alinhamento)
        .add_run(Run::new().add_text(texto).fonts(fonte_docx()).size(tamanho))
}

fn paragrafo_de_runs_docx(runs: &[Run_], negrito_extra: bool) -> Paragraph {
    let mut paragrafo =
        Paragraph::new().line_spacing(LineSpacing::new().line_rule(LineSpacingType::Auto).line(480));
    for run in runs {
        let mut r = Run::new()
            .add_text(run.texto.clone())
            .fonts(fonte_docx())
            .size(TAMANHO_FONTE_CORPO);
        if run.negrito || negrito_extra {
            r = r.bold();
        }
        if run.italico {
            r = r.italic();
        }
        paragrafo = paragrafo.add_run(r);
    }
    paragrafo
}

// Formato de manuscrito genérico (folha de rosto com título/autor/contato/
// contagem de palavras, cabeçalho corrente a partir da segunda página,
// espaço duplo, quebra de página por capítulo) — decisão registrada com o
// autor de usar um padrão comum em vez de tentar adivinhar a exigência
// exata de uma editora específica.
fn construir_docx(manuscrito: &Manuscrito) -> Docx {
    let mut docx = Docx::new().page_margin(
        PageMargin::new()
            .top(MARGEM_TWIPS)
            .bottom(MARGEM_TWIPS)
            .left(MARGEM_TWIPS)
            .right(MARGEM_TWIPS),
    );

    // Cabeçalho corrente (autor / título / nº de página via campo nativo do
    // Word, recalculado automaticamente). first_header vazio ativa o
    // title_pg do OOXML, suprimindo esse cabeçalho na folha de rosto.
    let texto_cabecalho = format!("{} / {}", manuscrito.autor, manuscrito.titulo);
    let cabecalho = Header::new().add_paragraph(
        Paragraph::new()
            .align(AlignmentType::Right)
            .add_run(Run::new().add_text(texto_cabecalho).fonts(fonte_docx()).size(20))
            .add_page_num(PageNum::new()),
    );
    docx = docx.header(cabecalho).first_header(Header::new());

    // Folha de rosto.
    if !manuscrito.contato.is_empty() {
        docx = docx.add_paragraph(paragrafo_simples_docx(
            &manuscrito.contato,
            TAMANHO_FONTE_CORPO,
            AlignmentType::Left,
        ));
    }
    docx = docx.add_paragraph(paragrafo_simples_docx(
        &format!("Aproximadamente {} palavras", manuscrito.contagem_palavras),
        TAMANHO_FONTE_CORPO,
        AlignmentType::Right,
    ));
    for _ in 0..8 {
        docx = docx.add_paragraph(Paragraph::new());
    }
    docx = docx.add_paragraph(
        Paragraph::new()
            .align(AlignmentType::Center)
            .add_run(
                Run::new()
                    .add_text(manuscrito.titulo.clone())
                    .fonts(fonte_docx())
                    .bold()
                    .size(TAMANHO_FONTE_TITULO),
            ),
    );
    docx = docx.add_paragraph(paragrafo_simples_docx(
        &format!("por {}", manuscrito.autor),
        TAMANHO_FONTE_CORPO,
        AlignmentType::Center,
    ));

    // Capítulos — cada um começa numa página nova, com um espaço
    // aproximado antes do título (convenção comum de manuscrito).
    for capitulo in &manuscrito.capitulos {
        docx = docx.add_paragraph(Paragraph::new().page_break_before(true));
        for _ in 0..5 {
            docx = docx.add_paragraph(Paragraph::new());
        }
        docx = docx.add_paragraph(
            Paragraph::new()
                .align(AlignmentType::Center)
                .add_run(
                    Run::new()
                        .add_text(capitulo.titulo.clone())
                        .fonts(fonte_docx())
                        .bold()
                        .size(TAMANHO_FONTE_TITULO),
                ),
        );
        docx = docx.add_paragraph(Paragraph::new());

        for bloco in &capitulo.blocos {
            docx = docx.add_paragraph(match bloco {
                Bloco::QuebraCena => {
                    paragrafo_simples_docx("***", TAMANHO_FONTE_CORPO, AlignmentType::Center)
                }
                Bloco::Titulo { runs } => paragrafo_de_runs_docx(runs, true).align(AlignmentType::Center),
                Bloco::Paragrafo { runs } => paragrafo_de_runs_docx(runs, false),
            });
        }
    }

    docx
}

#[tauri::command]
pub async fn exportar_manuscrito_docx(destino: String, manuscrito: Manuscrito) -> Result<(), String> {
    let docx = construir_docx(&manuscrito);
    let arquivo = std::fs::File::create(&destino).map_err(|e| e.to_string())?;
    docx.pack(arquivo).map_err(|e| e.to_string())
}

// A Times New Roman da Microsoft não pode ser redistribuída no instalador —
// em vez de embutir uma fonte substituta, lemos a instalação real do
// Windows em tempo de execução (decisão tomada com o autor: só Windows por
// enquanto, então essa dependência não é um problema agora). O genpdf
// exige os arquivos num diretório com convenção de nome própria
// ({nome}-Regular.ttf etc.), diferente dos nomes reais do Windows
// (times.ttf, timesbd.ttf...), então copiamos/renomeamos para uma pasta
// temporária uma única vez.
fn preparar_fonte_sistema() -> Result<PathBuf, String> {
    let pasta_fontes = std::env::temp_dir().join("the-inkbound-fontes");
    std::fs::create_dir_all(&pasta_fontes).map_err(|e| e.to_string())?;

    let pares = [
        ("times.ttf", "TimesNewRoman-Regular.ttf"),
        ("timesbd.ttf", "TimesNewRoman-Bold.ttf"),
        ("timesi.ttf", "TimesNewRoman-Italic.ttf"),
        ("timesbi.ttf", "TimesNewRoman-BoldItalic.ttf"),
    ];

    let pasta_windows_fontes =
        PathBuf::from(std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".to_string()))
            .join("Fonts");

    for (origem, destino) in pares {
        let caminho_destino = pasta_fontes.join(destino);
        if caminho_destino.exists() {
            continue;
        }
        let caminho_origem = pasta_windows_fontes.join(origem);
        std::fs::copy(&caminho_origem, &caminho_destino).map_err(|e| {
            format!(
                "Não foi possível ler a fonte Times New Roman do sistema ({}): {e}. A exportação em PDF depende de uma instalação padrão do Windows.",
                caminho_origem.display()
            )
        })?;
    }

    Ok(pasta_fontes)
}

fn paragrafo_de_runs_pdf(runs: &[Run_], negrito_extra: bool) -> genpdf::elements::Paragraph {
    let mut paragrafo = genpdf::elements::Paragraph::default();
    for run in runs {
        let negrito = run.negrito || negrito_extra;
        let mut estilo = genpdf::style::Style::new();
        if negrito {
            estilo = estilo.bold();
        }
        if run.italico {
            estilo = estilo.italic();
        }
        if negrito || run.italico {
            paragrafo.push_styled(run.texto.clone(), estilo);
        } else {
            paragrafo.push(run.texto.clone());
        }
    }
    paragrafo
}

fn construir_pdf(manuscrito: &Manuscrito) -> Result<genpdf::Document, String> {
    let pasta_fontes = preparar_fonte_sistema()?;
    let familia_fonte = genpdf::fonts::from_files(&pasta_fontes, "TimesNewRoman", None)
        .map_err(|e| format!("Falha ao carregar a fonte Times New Roman: {e}"))?;

    let mut doc = genpdf::Document::new(familia_fonte);
    doc.set_line_spacing(2.0);

    let mut decorator = genpdf::SimplePageDecorator::new();
    decorator.set_margins(genpdf::Margins::trbl(30.0, 30.0, 30.0, 30.0));
    let autor_cabecalho = manuscrito.autor.clone();
    let titulo_cabecalho = manuscrito.titulo.clone();
    decorator.set_header(move |pagina: usize| {
        let texto = if pagina <= 1 {
            String::new()
        } else {
            format!("{} / {} / {}", autor_cabecalho, titulo_cabecalho, pagina)
        };
        let mut paragrafo = genpdf::elements::Paragraph::new(texto);
        paragrafo.set_alignment(genpdf::Alignment::Center);
        paragrafo
    });
    doc.set_page_decorator(decorator);

    // Folha de rosto.
    if !manuscrito.contato.is_empty() {
        let mut p = genpdf::elements::Paragraph::new(manuscrito.contato.clone());
        p.set_alignment(genpdf::Alignment::Left);
        doc.push(p);
    }
    let mut contagem =
        genpdf::elements::Paragraph::new(format!("Aproximadamente {} palavras", manuscrito.contagem_palavras));
    contagem.set_alignment(genpdf::Alignment::Right);
    doc.push(contagem);

    for _ in 0..8 {
        doc.push(genpdf::elements::Paragraph::new(""));
    }

    let mut titulo_pagina = genpdf::elements::Paragraph::new(manuscrito.titulo.clone());
    titulo_pagina.set_alignment(genpdf::Alignment::Center);
    doc.push(titulo_pagina);

    let mut autor_pagina = genpdf::elements::Paragraph::new(format!("por {}", manuscrito.autor));
    autor_pagina.set_alignment(genpdf::Alignment::Center);
    doc.push(autor_pagina);

    for capitulo in &manuscrito.capitulos {
        doc.push(genpdf::elements::PageBreak::new());
        for _ in 0..5 {
            doc.push(genpdf::elements::Paragraph::new(""));
        }
        let mut titulo_cap = genpdf::elements::Paragraph::new(capitulo.titulo.clone());
        titulo_cap.set_alignment(genpdf::Alignment::Center);
        doc.push(titulo_cap);
        doc.push(genpdf::elements::Paragraph::new(""));

        for bloco in &capitulo.blocos {
            match bloco {
                Bloco::QuebraCena => {
                    let mut p = genpdf::elements::Paragraph::new("***");
                    p.set_alignment(genpdf::Alignment::Center);
                    doc.push(p);
                }
                Bloco::Titulo { runs } => {
                    let mut p = paragrafo_de_runs_pdf(runs, true);
                    p.set_alignment(genpdf::Alignment::Center);
                    doc.push(p);
                }
                Bloco::Paragrafo { runs } => {
                    doc.push(paragrafo_de_runs_pdf(runs, false));
                }
            }
        }
    }

    Ok(doc)
}

#[tauri::command]
pub async fn exportar_manuscrito_pdf(destino: String, manuscrito: Manuscrito) -> Result<(), String> {
    let documento = construir_pdf(&manuscrito)?;
    documento.render_to_file(&destino).map_err(|e| e.to_string())
}
