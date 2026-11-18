function quoteExists(quote,transcript){return !!quote&&!!transcript&&String(transcript).toLocaleLowerCase().includes(String(quote).trim().toLocaleLowerCase());}
