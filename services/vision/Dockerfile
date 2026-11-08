FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 qpdf \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
# Dependencies first, in their own layer: code changes don't reinstall them.
COPY services/vision/pyproject.toml ./
RUN python -c "import tomllib;p=tomllib.load(open('pyproject.toml','rb'))['project'];print('\n'.join(p['dependencies']+p['optional-dependencies']['vlm']))" > req.txt \
    && pip install --no-cache-dir -r req.txt
COPY services/vision/app ./app
COPY data /data
ENV REQUIREMENTS_DIR=/data/requirements RESOURCES_FILE=/data/resources.json
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
