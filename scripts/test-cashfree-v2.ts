import { 
  mapCashfreeStatus, 
  CreateBeneficiaryRequestV2, 
  CreateTransferRequestV2 
} from "../src/lib/cashfree";

function testMapping() {
  console.log("--- Testing Status Mapping ---");
  const tests = [
    { s: "SUCCESS", c: "COMPLETED", expected: "SUCCESS" },
    { s: "SUCCESS", c: "SENT_TO_BENEFICIARY", expected: "SUCCESS" },
    { s: "FAILED", c: "FAILED", expected: "FAILURE" },
    { s: "REJECTED", c: "REJECTED", expected: "FAILURE" },
    { s: "REVERSED", c: "REVERSED", expected: "REVERSED" },
    { s: "PENDING", c: "PENDING", expected: "PENDING" },
    { s: "RECEIVED", c: "RECEIVED", expected: "PENDING" },
  ];

  tests.forEach(({ s, c, expected }) => {
    const result = mapCashfreeStatus(s, c);
    console.log(`Input: [${s}, ${c}] -> Result: ${result} (Expected: ${expected})`);
    if (result !== expected) throw new Error(`Mapping failed for ${s}, ${c}`);
  });
  console.log("Status mapping tests PASSED\n");
}

function testPayloadStructures() {
  console.log("--- Testing Payload Structures ---");
  
  const benePayload: CreateBeneficiaryRequestV2 = {
    beneficiary_id: "BENE_123",
    beneficiary_name: "John Doe",
    beneficiary_instrument_details: {
      bank_account_number: "123456789",
      bank_ifsc: "HDFC0000001"
    },
    beneficiary_contact_details: {
      beneficiary_email: "john@example.com",
      beneficiary_phone: "9876543210"
    }
  };

  console.log("Beneficiary Payload (Nested):", JSON.stringify(benePayload, null, 2));
  if (!benePayload.beneficiary_instrument_details.bank_account_number) {
    throw new Error("Beneficiary instrument details missing or flat!");
  }

  const transferPayload: CreateTransferRequestV2 = {
    transfer_id: "TR_123",
    transfer_amount: 100,
    beneficiary_details: {
      beneficiary_id: "BENE_123"
    }
  };

  console.log("Transfer Payload (Nested):", JSON.stringify(transferPayload, null, 2));
  if (!transferPayload.beneficiary_details.beneficiary_id) {
    throw new Error("Transfer beneficiary details missing or flat!");
  }

  console.log("Payload structure tests PASSED\n");
}

try {
  testMapping();
  testPayloadStructures();
  console.log("ALL VERIFICATION TESTS PASSED!");
} catch (err) {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
}
