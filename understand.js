// Evidence helpers. A matching quote proves the words appeared, not that interpretation is correct.
function quoteExists(quote,transcript){return !!quote&&!!transcript&&String(transcript).toLocaleLowerCase().includes(String(quote).trim().toLocaleLowerCase());}
