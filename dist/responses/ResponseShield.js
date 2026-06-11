import { deepClone, enforceMaxSize, MAX_RESPONSE_BYTES, stripHeavyFields, truncateArrays, truncateStrings, } from "./response-truncation.js";
export class ResponseShield {
    responseStore;
    constructor(responseStore) {
        this.responseStore = responseStore;
    }
    shield(toolId, raw) {
        let shielded = deepClone(raw);
        let wasTruncated = false;
        shielded = truncateArrays(shielded, (didTruncate) => {
            if (didTruncate)
                wasTruncated = true;
        });
        shielded = stripHeavyFields(shielded, (didStrip) => {
            if (didStrip)
                wasTruncated = true;
        });
        shielded = truncateStrings(shielded, (didTruncate) => {
            if (didTruncate)
                wasTruncated = true;
        });
        if (JSON.stringify(shielded).length > MAX_RESPONSE_BYTES) {
            shielded = enforceMaxSize(shielded);
            wasTruncated = true;
        }
        const ref = wasTruncated ? this.responseStore.store(toolId, raw) : null;
        return { shielded, ref, wasTruncated };
    }
}
//# sourceMappingURL=ResponseShield.js.map