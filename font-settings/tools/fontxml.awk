function attribute(tag, name,    pattern, value) {
  pattern = name "=\"[^\"]*\""
  if (!match(tag, pattern)) return ""
  value = substr(tag, RSTART + length(name) + 2, RLENGTH - length(name) - 3)
  return value
}

function strip_name(tag) {
  gsub(/[[:space:]]+name="[^"]*"/, "", tag)
  return tag
}

function family_role(header, block,    name, lang, normalized) {
  name = tolower(attribute(header, "name"))
  lang = tolower(attribute(header, "lang"))
  normalized = "," lang ","
  gsub(/[[:space:]_]+/, "-", normalized)

  if (name == "sans-serif" || name == "sys-sans-en" || name == "op-sans-en") {
    return "western"
  }
  if (normalized ~ /[,;-](zh|yue)(-|[,;])/) {
    return "chinese"
  }
  if (allow_unnamed == 1 && unnamed_default == 0 && name == "" && lang == "" &&
      block ~ /\.(ttf|otf|ttc)/ && block !~ /[Ee]moji|[Ss]ymbol|[Mm]ath/) {
    unnamed_default = 1
    return "western"
  }
  return ""
}

function emit_family(    header, block, role, indent, i, j, opening, weight,
                         nslot, f, nf, file, variable, s, line, hdr) {
  header = ""
  block = ""
  for (i = 1; i <= family_count; i++) {
    block = block " " family_lines[i]
    if (header !~ />/) header = header " " family_lines[i]
  }
  gsub(/[\r\n\t]+/, " ", header)
  sub(/^[[:space:]]*/, "", header)
  sub(/>.*/, ">", header)

  role = family_role(header, block)
  if (role == "") {
    for (i = 1; i <= family_count; i++) print family_lines[i]
    return
  }

  indent = family_lines[1]
  sub(/[^[:space:]].*$/, "", indent)

  nslot = 0
  i = 1
  while (i <= family_count) {
    if (family_lines[i] ~ /<font([[:space:]>])/) {
      opening = family_lines[i]
      j = i + 1
      while (j <= family_count && opening !~ />/) {
        opening = opening " " family_lines[j]
        j++
      }
      gsub(/[\r\n\t]+/, " ", opening)
      sub(/^[[:space:]]*/, "", opening)
      sub(/>.*/, ">", opening)
      weight = attribute(opening, "weight")
      if (weight == "") weight = "400"
      nslot++
      slot_weight[nslot] = weight
      slot_style[nslot] = attribute(opening, "style")
      slot_fallback[nslot] = attribute(opening, "fallbackFor")
      while (i <= family_count && family_lines[i] !~ /<\/font>/) i++
      i++
    } else {
      i++
    }
  }
  if (nslot == 0) {
    nslot = 1
    slot_weight[1] = "400"
    slot_style[1] = ""
    slot_fallback[1] = ""
  }

  if (role == "western") {
    nf = split(western_list, files, ",")
    split(western_vars, vars, ",")
  } else {
    nf = split(chinese_list, files, ",")
    split(chinese_vars, vars, ",")
  }
  if (nf > max_fonts) nf = max_fonts

  for (f = 1; f <= nf; f++) {
    file = files[f]
    if (file == "") continue
    variable = vars[f]
    hdr = (f == 1) ? header : strip_name(header)
    print indent hdr
    for (s = 1; s <= nslot; s++) {
      line = indent "    <font"
      if (slot_weight[s] != "") line = line " weight=\"" slot_weight[s] "\""
      if (slot_style[s] != "") line = line " style=\"" slot_style[s] "\""
      if (slot_fallback[s] != "") line = line " fallbackFor=\"" slot_fallback[s] "\""
      if (role == "western" && f == 1 && western_size != "" && western_size != "100") {
        line = line " size=\"" western_size "\""
      }
      line = line ">"
      print line
      print indent "        " file
      if (variable == 1) {
        print indent "        <axis tag=\"wght\" stylevalue=\"" slot_weight[s] "\"/>"
      }
      print indent "    </font>"
    }
    print indent "</family>"
  }

  if (fallback == 1) {
    for (i = 1; i <= family_count; i++) print family_lines[i]
  }

  if (role == "western") western_fonts++
  else chinese_fonts++
}

BEGIN {
  in_family = 0
  family_count = 0
  western_fonts = 0
  chinese_fonts = 0
  unnamed_default = 0
  if (max_fonts == "") max_fonts = 8
}

{
  if (!in_family && $0 ~ /<family([[:space:]>])/) {
    in_family = 1
    family_count = 0
  }

  if (in_family) {
    family_lines[++family_count] = $0
    if ($0 ~ /<\/family>/) {
      emit_family()
      delete family_lines
      family_count = 0
      in_family = 0
    }
    next
  }

  print
}

END {
  if (in_family) {
    for (i = 1; i <= family_count; i++) print family_lines[i]
  }
  if (stats != "") print western_fonts " " chinese_fonts > stats
}
