import base64

with open(r'C:\Users\WAHYU\Downloads\itzcrih_optimized_1786053368_a5ab8144.mp4', 'rb') as f:
    working = f.read()

target_moov = bytearray(working[32 : 32 + 76668])
moov_str_bytes = bytes(target_moov)

clean_moov = bytearray(moov_str_bytes
    .replace(b'itzcrih.it', b'apple.it  ')
    .replace(b'itzCrih Method', b'Apple  Method ')
    .replace(b'method.itzcrih.it', b'method.apple.it  ')
)

b64_str = base64.b64encode(clean_moov).decode('ascii')

with open(r'C:\Users\WAHYU\Documents\GitHub\editorstuff\scripts\v3_moov_compressed_template.js', 'w', encoding='utf-8') as f_out:
    f_out.write('window.V3_MOOV_COMPRESSED_B64 = "' + b64_str + '";\n')

print('Success! Base64 len:', len(b64_str))
