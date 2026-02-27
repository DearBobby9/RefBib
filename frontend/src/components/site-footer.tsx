"use client";

import { BookOpen, Bug, Mail, Star } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">RefBib</span>
            <span className="text-muted-foreground/30">&middot;</span>
            <span className="text-xs text-muted-foreground/70">
              Powered by{" "}
              <a
                href="https://github.com/kermitt2/grobid"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted-foreground"
              >
                GROBID
              </a>
              {" / "}
              <a
                href="https://www.crossref.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted-foreground"
              >
                CrossRef
              </a>
              {" / "}
              <a
                href="https://www.semanticscholar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted-foreground"
              >
                S2
              </a>
              {" / "}
              <a
                href="https://dblp.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-muted-foreground"
              >
                DBLP
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <a
              href="https://github.com/DearBobby9/RefBib"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <Star className="h-3.5 w-3.5" />
              Star on GitHub
            </a>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="https://github.com/DearBobby9/RefBib/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <Bug className="h-3.5 w-3.5" />
              Report a bug
            </a>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="mailto:bobbyjia99@gmail.com"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              <Mail className="h-3.5 w-3.5" />
              bobbyjia99@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center text-xs text-muted-foreground/80">
            <span>
              Designed and built by{" "}
              <span className="font-medium text-muted-foreground">
                Difan (Bobby) Jia
              </span>
            </span>
            <span className="text-muted-foreground/30">|</span>
            <a
              href="https://x.com/KeithMaxwell99"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              X @KeithMaxwell99
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
